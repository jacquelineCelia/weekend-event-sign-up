import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { PhotoOrder } from '@/lib/photo-order';
import { hashIp, photoFeed, photoImage, photoTopics, removePhoto, savePhoto } from '@/lib/photos';

const pool = getPool();
const jpeg = (size = 100) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(size)]);
let topic: string;

beforeEach(async () => {
  await pool.query('truncate photos');
  topic = (await photoTopics('en'))[0].id;
});
afterAll(() => pool.end());

const save = (over: Partial<Parameters<typeof savePhoto>[0]> = {}, limits = {}) =>
  savePhoto({ name: 'Anna Park', topicId: topic, image: jpeg(), ipHash: 'net', ...over }, limits);

describe('photo uploads', () => {
  it('starts with nine topics, in Chinese too', async () => {
    expect(await photoTopics('en')).toHaveLength(9);
    expect((await photoTopics('en'))[0]).toMatchObject({ name: 'Around the Corner', hint: 'Find a corner of the estate you’ve never noticed.' });
    expect((await photoTopics('zh'))[0]).toMatchObject({ name: '轉角發現', hint: '找到一處你從未留意的莊園角落。' });
    expect((await photoTopics('zhs'))[0]).toMatchObject({ name: '转角发现', hint: '找到一处你从未留意的庄园角落。' });
    for (const t of await photoTopics('en')) expect(t.hint).not.toBe('');
  });

  it('saves a photo and shows it in the feed with its topic and tidied name', async () => {
    const r = await save({ name: '  Anna \n  Park ' });
    expect(r).toHaveProperty('id');
    expect((await photoFeed('en')).map((p) => [p.name, p.topic])).toEqual([['Anna Park', 'Around the Corner']]);
    expect((await photoImage((r as { id: string }).id))?.equals(jpeg())).toBe(true);
  });

  it('orders the feed by topic, oldest first within a topic', async () => {
    const topics = await photoTopics('en');
    const add = async (name: string, t: number, ago: number) => {
      const { id } = (await save({ name, topicId: topics[t].id })) as { id: string };
      await pool.query(`update photos set created_at = now() - make_interval(mins => $2) where id = $1`, [id, ago]);
    };
    await add('second topic', 1, 1);
    await add('first topic, older', 0, 30);
    await add('ninth topic', 8, 0);
    await add('first topic, newer', 0, 5);
    expect((await photoFeed('en')).map((p) => p.name)).toEqual(['first topic, older', 'first topic, newer', 'second topic', 'ninth topic']);
  });

  it('refuses a missing or overlong name, an unknown topic and anything but a JPEG', async () => {
    expect(await save({ name: '   ' })).toEqual({ error: 'name' });
    expect(await save({ name: 'x'.repeat(61) })).toEqual({ error: 'name' });
    expect(await save({ topicId: 'nope' })).toEqual({ error: 'topic' });
    expect(await save({ topicId: '00000000-0000-4000-8000-000000000000' })).toEqual({ error: 'topic' });
    expect(await save({ image: Buffer.from('<svg onload="x">') })).toEqual({ error: 'image' });
    expect(await save({ image: jpeg(5 * 1024 * 1024) })).toEqual({ error: 'image' });
  });

  it('limits uploads per network, leaving other networks alone', async () => {
    await save({}, { maxPerIp: 1 });
    expect(await save({}, { maxPerIp: 1 })).toEqual({ error: 'busy' });
    expect(await save({ ipHash: 'other' }, { maxPerIp: 1 })).toHaveProperty('id');
  });

  it('stops at the storage limit', async () => {
    await save({}, { maxTotal: 200 });
    expect(await save({}, { maxTotal: 200 })).toEqual({ error: 'full' });
  });

  it('removing a photo takes it out of the feed and deletes the image', async () => {
    const { id } = (await save()) as { id: string };
    await removePhoto(id);
    await removePhoto('not-a-uuid');
    expect(await photoFeed('en')).toEqual([]);
    expect(await photoImage(id)).toBeNull();
    expect(await photoImage('not-a-uuid')).toBeNull();
  });

  it('hashes addresses', () => {
    expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4');
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
  });
});

describe('photo order', () => {
  const take = (o: PhotoOrder, n: number) => Array.from({ length: n }, () => o.next());

  it('goes through the list in order and starts again', () => {
    const o = new PhotoOrder();
    o.sync(['a', 'b', 'c']);
    expect(take(o, 5)).toEqual(['a', 'b', 'c', 'a', 'b']);
  });

  it('shows new uploads next, then returns to its place, and keeps them in later rounds', () => {
    const o = new PhotoOrder();
    o.sync(['a', 'b', 'c']);
    take(o, 2); // on b
    o.sync(['new1', 'a', 'b', 'new2', 'c']);
    expect(take(o, 7)).toEqual(['new1', 'new2', 'new2', 'c', 'new1', 'a', 'b']);
  });

  it('treats the photos already there at the start as the normal list, not new', () => {
    const o = new PhotoOrder();
    o.sync(['a', 'b']);
    expect(take(o, 2)).toEqual(['a', 'b']);
  });

  it('counts the first photos of an empty show as new', () => {
    const o = new PhotoOrder();
    o.sync([]);
    o.sync(['a']);
    expect(o.next()).toBe('a');
  });

  it('forgets a new upload that was removed before it showed', () => {
    const o = new PhotoOrder();
    o.sync(['a', 'b']);
    o.next();
    o.sync(['a', 'new', 'b']);
    o.sync(['a', 'b']);
    expect(o.next()).toBe('b');
  });

  it('moves on to what followed a removed photo', () => {
    const o = new PhotoOrder();
    o.sync(['a', 'b', 'c']);
    take(o, 2); // on b
    o.sync(['a', 'c']);
    expect(o.next()).toBe('c');
    o.sync(['a']); // c, the last one, is gone: back to the start
    expect(o.next()).toBe('a');
  });

  it('handles none and one', () => {
    const o = new PhotoOrder();
    expect(o.next()).toBeNull();
    o.sync(['a']);
    expect(take(o, 2)).toEqual(['a', 'a']);
    o.sync([]);
    expect(o.next()).toBeNull();
    o.sync(['b']);
    expect(o.next()).toBe('b');
  });
});
