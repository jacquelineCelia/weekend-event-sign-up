import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { getPool } from './db';
import { localText } from './hans';
import type { Lang } from './event';

/** Vercel refuses request bodies over 4.5 MB; the browser resizes photos well below this. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/**
 * Photos share the event's database, and a full database would stop sign-ups and check-in too.
 * Uploads stop at this total (about 800 photos), well inside Supabase's 500 MB free plan.
 */
export const MAX_TOTAL_BYTES = 400 * 1024 * 1024;

/** Per network, not per person: a venue's guests can all share one Wi-Fi address. */
export const MAX_PER_IP = 60;
const IP_WINDOW_MIN = 10;

export type PhotoError = 'name' | 'topic' | 'image' | 'busy' | 'full';
export type PhotoTopic = { id: string; name: string; hint: string };
/** `fresh`: not shown yet, so it plays first. `uploaded`: when it arrived, in milliseconds. */
export type ShowPhoto = { id: string; name: string; topic: string; fresh: boolean; uploaded: number };

const uuid = z.string().uuid();
const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** The hashed address lets repeat uploads be counted without keeping anyone's IP. */
export function hashIp(ip: string) {
  return createHmac('sha256', process.env.SESSION_SECRET ?? '').update(ip).digest('base64url');
}

export async function photoTopics(lang: Lang): Promise<PhotoTopic[]> {
  const { rows } = await getPool().query<{ id: string; name: string; name_zh: string; hint: string; hint_zh: string }>(
    'select id, name, name_zh, hint, hint_zh from photo_topics order by sort_order, name',
  );
  return rows.map((r) => ({ id: r.id, name: localText(r.name, r.name_zh, lang), hint: localText(r.hint, r.hint_zh, lang) }));
}

export async function savePhoto(
  input: { name: string; topicId: string; image: Buffer; ipHash: string },
  limits: { maxTotal?: number; maxPerIp?: number } = {},
): Promise<{ id: string } | { error: PhotoError }> {
  const name = input.name.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
  if (!name || name.length > 60) return { error: 'name' };
  if (!uuid.safeParse(input.topicId).success) return { error: 'topic' };
  // Only JPEGs: the browser re-encodes every photo, which also removes its location data.
  if (!isJpeg(input.image) || input.image.length > MAX_PHOTO_BYTES) return { error: 'image' };

  const pool = getPool();
  const topic = await pool.query('select 1 from photo_topics where id = $1', [input.topicId]);
  if (!topic.rowCount) return { error: 'topic' };
  const usage = (await pool.query<{ total: number; recent: number }>(
    `select coalesce(sum(bytes), 0)::bigint::float8 as total,
            count(*) filter (where ip_hash = $1 and created_at > now() - make_interval(mins => $2))::int as recent
       from photos`,
    [input.ipHash, IP_WINDOW_MIN],
  )).rows[0];
  if (usage.recent >= (limits.maxPerIp ?? MAX_PER_IP)) return { error: 'busy' };
  if (usage.total + input.image.length > (limits.maxTotal ?? MAX_TOTAL_BYTES)) return { error: 'full' };

  const { rows } = await pool.query<{ id: string }>(
    'insert into photos (topic_id, name, image, bytes, ip_hash) values ($1, $2, $3, $4, $5) returning id',
    [input.topicId, name, input.image, input.image.length, input.ipHash],
  );
  return { id: rows[0].id };
}

/** Every photo in the show, by topic and oldest first within a topic, without the image data. */
export async function photoFeed(lang: Lang): Promise<ShowPhoto[]> {
  const { rows } = await getPool().query<{ id: string; name: string; topic: string; topic_zh: string; fresh: boolean; created_at: Date }>(
    `select p.id, p.name, t.name as topic, t.name_zh as topic_zh, p.first_shown_at is null as fresh, p.created_at
       from photos p join photo_topics t on t.id = p.topic_id order by t.sort_order, p.created_at, p.id`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, topic: localText(r.topic, r.topic_zh, lang), fresh: r.fresh, uploaded: r.created_at.getTime() }));
}

export async function photoImage(id: string): Promise<Buffer | null> {
  if (!uuid.safeParse(id).success) return null;
  const { rows } = await getPool().query<{ image: Buffer }>('select image from photos where id = $1', [id]);
  return rows[0]?.image ?? null;
}

/** Records that a photo has appeared in the show, so it stops counting as new. */
export async function markPhotoShown(id: string) {
  if (!uuid.safeParse(id).success) return;
  await getPool().query('update photos set first_shown_at = now() where id = $1 and first_shown_at is null', [id]);
}

export async function removePhoto(id: string) {
  if (!uuid.safeParse(id).success) return;
  await getPool().query('delete from photos where id = $1', [id]);
}
