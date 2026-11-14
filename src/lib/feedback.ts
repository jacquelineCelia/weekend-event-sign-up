import { z } from 'zod';
import { getPool } from './db';
import { normalizeEmail } from './contact';
import { AGES, CEREMONY, MAX_TEXT, OPTIONAL_SCALES, SCALES, type Age, type Rated } from './feedback-questions';

/**
 * Links to the weekend feedback page (/feedback): the card on the activity list and the link on My sign-ups.
 * Hidden until the organizers say to show them (after the weekend); the page itself always works.
 */
export const SHOW_FEEDBACK_LINKS = false;


export { SCALES, MAX_TEXT };
/** Forms per network per window, so a script can't flood the table. */
const LIMIT = 10;
const WINDOW_MIN = 10;

export type FeedbackInput = {
  name: string; email: string; age: string;
  toGuru: string;                  // 1
  scores: Partial<Record<Rated, number>>; // 2–7 and 8-1 … 8-5
  noActivities: boolean;           // 我沒有參加療癒體驗活動: then no activities and no 8-x scores
  activityIds: string[];
  comment: string;                 // 9
};
export type FeedbackError = 'name' | 'email' | 'age' | 'toGuru' | 'activities' | Rated | 'comment' | 'busy';

const score = z.coerce.number().int().min(1).max(5);
const bad = (v: number | undefined) => !score.safeParse(v).success;

/** Checks a sent form. Returns the problems, field by field, in page order (empty when it can be saved). */
export function checkFeedback(input: FeedbackInput, validActivityIds: string[]): FeedbackError[] {
  const errors: FeedbackError[] = [];
  const name = input.name.trim();
  if (!name || name.length > 60) errors.push('name');
  if (!normalizeEmail(input.email)) errors.push('email');
  if (!AGES.includes(input.age as Age)) errors.push('age');
  if (input.toGuru.length > MAX_TEXT) errors.push('toGuru');
  for (const k of CEREMONY) if (bad(input.scores[k])) errors.push(k);
  if (!input.noActivities) {
    if (!input.activityIds.length || input.activityIds.some((id) => !validActivityIds.includes(id))) errors.push('activities');
    for (const s of SCALES) {
      const v = input.scores[s];
      if (v === undefined ? !OPTIONAL_SCALES.includes(s) : bad(v)) errors.push(s);
    }
  }
  if (input.comment.length > MAX_TEXT) errors.push('comment');
  return errors;
}

/** Database column for each 1–5 question. */
const COLUMN: Record<Rated, string> = {
  joy: 'joy', talks: 'learn_talks', sangha: 'learn_sangha', lay: 'learn_lay', chant: 'learn_chant',
  moving: 'sat_moving', timing: 'sat_timing', hosts: 'sat_hosts', performers: 'sat_performers',
  stage: 'sat_stage', lighting: 'sat_lighting', sound: 'sat_sound', video: 'sat_video',
  seating: 'sat_seating', food: 'sat_food', volunteers: 'sat_volunteers',
  relax: 'relax', venue: 'venue', guidance: 'guidance', transition: 'transition', again: 'again',
};

/** Saves a checked form, unless this network has sent too many lately (then 'busy'). */
export async function saveFeedback(input: FeedbackInput, opts: { personId: string | null; lang: string; ipHash: string }) {
  const pool = getPool();
  const recent = await pool.query<{ n: number }>(
    `select count(*)::int as n from event_feedback where ip_hash = $1 and created_at > now() - make_interval(mins => $2)`,
    [opts.ipHash, WINDOW_MIN],
  );
  if (opts.ipHash && recent.rows[0].n >= LIMIT) return 'busy' as const;
  const rated = [...CEREMONY, ...(input.noActivities ? [] : SCALES)];
  const cols: [string, unknown][] = [
    ['person_id', opts.personId], ['name', input.name.trim()], ['email', normalizeEmail(input.email)], ['lang', opts.lang],
    ['age', input.age], ['to_guru', input.toGuru.trim()], ['no_activities', input.noActivities],
    ['activity_ids', input.noActivities ? [] : [...new Set(input.activityIds)]],
    ...rated.map((k): [string, unknown] => [COLUMN[k], input.scores[k] ?? null]),
    ['comment', input.comment.trim()], ['ip_hash', opts.ipHash],
  ];
  await pool.query(
    `insert into event_feedback (${cols.map((c) => c[0]).join(', ')})
     values (${cols.map((c, i) => (c[0] === 'activity_ids' ? `$${i + 1}::uuid[]` : `$${i + 1}`)).join(', ')})`,
    cols.map((c) => c[1]),
  );
  return 'saved' as const;
}
