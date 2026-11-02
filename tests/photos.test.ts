import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { PhotoOrder } from '@/lib/photo-order';
import { hashIp, markPhotoShown, photoFeed, photoImage, photoTopics, removePhoto, savePhoto } from '@/lib/photos';

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

  it('a photo counts as new until it has been shown', async () => {
    const { id } = (await save()) as { id: string };
    expect((await photoFeed('en'))[0].fresh).toBe(true);
    await markPhotoShown(id);
    await markPhotoShown('not-a-uuid');
    expect((await photoFeed('en'))[0].fresh).toBe(false);
    const first = (await pool.query('select first_shown_at from photos where id = $1', [id])).rows[0].first_shown_at;
    await markPhotoShown(id);
    expect((await pool.query('select first_shown_at from photos where id = $1', [id])).rows[0].first_shown_at).toEqual(first);
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
  /** Lists photos in order; a number marks a new photo, with its upload time. */
  const list = (...xs: (string | [string, number])[]) =>
    xs.map((x) => (typeof x === 'string' ? { id: x, fresh: false, uploaded: 0 } : { id: x[0], fresh: true, uploaded: x[1] }));

  it('goes through the list in order and starts again', () => {
    const o = new PhotoOrder();
    o.sync(list('a', 'b', 'c'));
    expect(take(o, 5)).toEqual(['a', 'b', 'c', 'a', 'b']);
  });

  it('shows new photos next, oldest upload first, then returns to its place', () => {
    const o = new PhotoOrder();
    o.sync(list('a', 'b', 'c'));
    take(o, 2); // on b
    o.sync(list(['later', 2], 'a', 'b', ['earlier', 1], 'c'));
    expect(take(o, 7)).toEqual(['earlier', 'later', 'earlier', 'c', 'later', 'a', 'b']);
  });

  it('plays photos not yet shown first after a reload, and not ones already shown', () => {
    const o = new PhotoOrder(); // a reloaded page: 'seen' was shown before, 'new' never was
    o.sync(list('seen', ['new', 1]));
    expect(take(o, 3)).toEqual(['new', 'seen', 'new']);
  });

  it('does not repeat a new photo while the server has yet to record it as shown', () => {
    const o = new PhotoOrder();
    o.sync(list('a', ['new', 1]));
    expect(o.next()).toBe('new');
    o.sync(list('a', ['new', 1])); // the feed still says new
    expect(o.next()).toBe('a');
  });

  it('forgets a new photo that was removed before it showed', () => {
    const o = new PhotoOrder();
    o.sync(list('a', 'b'));
    o.next();
    o.sync(list('a', ['new', 1], 'b'));
    o.sync(list('a', 'b'));
    expect(o.next()).toBe('b');
  });

  it('moves on to what followed a removed photo', () => {
    const o = new PhotoOrder();
    o.sync(list('a', 'b', 'c'));
    take(o, 2); // on b
    o.sync(list('a', 'c'));
    expect(o.next()).toBe('c');
    o.sync(list('a')); // c, the last one, is gone: back to the start
    expect(o.next()).toBe('a');
  });

  it('carries on from the saved place after a reload, new photos first', () => {
    const o = new PhotoOrder('b');
    o.sync(list('a', 'b', ['new', 1], 'c'));
    expect(take(o, 3)).toEqual(['new', 'new', 'c']);
    expect(o.position()).toBe('c');
  });

  it('does not count a new photo played ahead of the list as its place', () => {
    const o = new PhotoOrder();
    o.sync(list('a', ['new', 1], 'b'));
    o.next();
    expect(o.position()).toBeNull();
    o.next();
    expect(o.position()).toBe('a');
  });

  it('starts from the top if the saved photo is gone, and wraps after the last', () => {
    const gone = new PhotoOrder('removed');
    gone.sync(list('a', 'b'));
    expect(gone.next()).toBe('a');
    const last = new PhotoOrder('b');
    last.sync(list('a', 'b'));
    expect(last.next()).toBe('a');
  });

  it('handles none and one', () => {
    const o = new PhotoOrder();
    expect(o.next()).toBeNull();
    o.sync(list('a'));
    expect(take(o, 2)).toEqual(['a', 'a']);
    o.sync([]);
    expect(o.next()).toBeNull();
  });
});
