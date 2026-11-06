import { z } from 'zod';
import { getPool } from './db';
import { normalizeEmail } from './contact';

/**
 * Links to the weekend feedback page (/feedback): the card on the activity list and the link on My sign-ups.
 * Hidden until the organizers say to show them (after the weekend); the page itself always works.
 */
export const SHOW_FEEDBACK_LINKS = false;

/** The five 1–5 questions, in the order they are asked. "transition" may be left blank. */
export const SCALES = ['relax', 'venue', 'guidance', 'transition', 'again'] as const;
export type Scale = (typeof SCALES)[number];
export const OPTIONAL_SCALES: readonly Scale[] = ['transition'];

export const MAX_COMMENT = 2000;
/** Forms per network per window, so a script can't flood the table. */
const LIMIT = 10;
const WINDOW_MIN = 10;

export type FeedbackInput = {
  name: string; email: string; activityIds: string[];
  scores: Partial<Record<Scale, number>>; comment: string;
};
export type FeedbackError = 'name' | 'email' | 'activities' | Scale | 'comment' | 'busy';

const score = z.coerce.number().int().min(1).max(5);

/** Checks a sent form. Returns the problems, field by field (empty when it can be saved). */
export function checkFeedback(input: FeedbackInput, validActivityIds: string[]): FeedbackError[] {
  const errors: FeedbackError[] = [];
  const name = input.name.trim();
  if (!name || name.length > 60) errors.push('name');
  if (!normalizeEmail(input.email)) errors.push('email');
  if (!input.activityIds.length || input.activityIds.some((id) => !validActivityIds.includes(id))) errors.push('activities');
  for (const s of SCALES) {
    const v = input.scores[s];
    if (v === undefined ? !OPTIONAL_SCALES.includes(s) : !score.safeParse(v).success) errors.push(s);
  }
  if (input.comment.length > MAX_COMMENT) errors.push('comment');
  return errors;
}

/** Saves a checked form, unless this network has sent too many lately (then 'busy'). */
export async function saveFeedback(input: FeedbackInput, opts: { personId: string | null; lang: string; ipHash: string }) {
  const pool = getPool();
  const recent = await pool.query<{ n: number }>(
    `select count(*)::int as n from event_feedback where ip_hash = $1 and created_at > now() - make_interval(mins => $2)`,
    [opts.ipHash, WINDOW_MIN],
  );
  if (opts.ipHash && recent.rows[0].n >= LIMIT) return 'busy' as const;
  await pool.query(
    `insert into event_feedback (person_id, name, email, lang, activity_ids, relax, venue, guidance, transition, again, comment, ip_hash)
     values ($1, $2, $3, $4, $5::uuid[], $6, $7, $8, $9, $10, $11, $12)`,
    [
      opts.personId, input.name.trim(), normalizeEmail(input.email), opts.lang, [...new Set(input.activityIds)],
      input.scores.relax, input.scores.venue, input.scores.guidance, input.scores.transition ?? null, input.scores.again,
      input.comment.trim(), opts.ipHash,
    ],
  );
  return 'saved' as const;
}
