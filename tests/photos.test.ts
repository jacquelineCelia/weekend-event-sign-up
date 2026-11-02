import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { PhotoOrder, shuffled } from '@/lib/photo-order';
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
  const round = (o: PhotoOrder, n: number, start: string | null = null) => {
    const out: string[] = [];
    let cur = start;
    for (let i = 0; i < n; i++) out.push((cur = o.next(cur)!));
    return out;
  };

  it('shuffles without losing anything', () => {
    expect(shuffled([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows every photo once before any repeats, and never the same one twice in a row', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const o = new PhotoOrder();
    o.sync(ids);
    let last: string | null = null;
    for (let i = 0; i < 50; i++) {
      const pass = round(o, 5, last);
      expect([...pass].sort()).toEqual(ids);
      if (last) expect(pass[0]).not.toBe(last);
      last = pass[4];
    }
  });

  it('brings in new photos before the current round ends and drops removed ones', () => {
    const o = new PhotoOrder();
    o.sync(['a', 'b', 'c']);
    const first = o.next(null)!;
    const rest = ['a', 'b', 'c'].filter((x) => x !== first);
    o.sync([first, rest[0], 'new']);
    expect(round(o, 2, first).sort()).toEqual([rest[0], 'new'].sort());
  });

  it('handles none and one', () => {
    const o = new PhotoOrder();
    expect(o.next(null)).toBeNull();
    o.sync(['a']);
    expect(round(o, 3)).toEqual(['a', 'a', 'a']);
    o.sync([]);
    expect(o.next('a')).toBeNull();
  });
});
