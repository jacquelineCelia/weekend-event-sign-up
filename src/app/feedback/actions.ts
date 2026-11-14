'use server';

import { headers } from 'next/headers';
import { getPool } from '@/lib/db';
import { normalizeEmail } from '@/lib/contact';
import { checkFeedback, saveFeedback, type FeedbackError, type FeedbackInput } from '@/lib/feedback';
import { CEREMONY, SCALES } from '@/lib/feedback-questions';
import { hashIp } from '@/lib/photos';
import { activitiesAllDays } from '@/lib/queries';
import { getLang } from '@/lib/lang';
import { currentOwners } from '@/lib/viewer';

export type FeedbackState = { errors?: FeedbackError[]; done?: boolean } | null;

export async function sendFeedbackAction(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const scores: FeedbackInput['scores'] = {};
  for (const k of [...CEREMONY, ...SCALES]) {
    const v = form.get(k);
    if (v !== null && v !== '') scores[k] = Number(v);
  }
  const input: FeedbackInput = {
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    age: String(form.get('age') ?? ''),
    toGuru: String(form.get('toGuru') ?? ''),
    scores,
    noActivities: form.get('noActivities') === '1',
    activityIds: form.getAll('activity').map(String),
    comment: String(form.get('comment') ?? ''),
  };
  const listed = (await activitiesAllDays()).filter((a) => a.slots.length > 0).map((a) => a.id);
  const errors = checkFeedback(input, listed);
  if (errors.length) return { errors };

  // Link it to the signed-in person when the email is theirs.
  const { ids } = await currentOwners();
  let personId: string | null = null;
  if (ids.length) {
    const r = await getPool().query<{ id: string }>(
      'select id from people where id = any($1::uuid[]) and lower(email) = $2 order by created_at limit 1',
      [ids, normalizeEmail(input.email)],
    );
    personId = r.rows[0]?.id ?? null;
  }
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const result = await saveFeedback(input, { personId, lang: await getLang(), ipHash: ip ? hashIp(ip) : '' });
  return result === 'busy' ? { errors: ['busy'] } : { done: true };
}
