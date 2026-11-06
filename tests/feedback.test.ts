import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { checkFeedback, saveFeedback, type FeedbackInput } from '@/lib/feedback';

const pool = getPool();
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const good = (): FeedbackInput => ({
  name: 'Mei Lin', email: 'Mei@Example.com', activityIds: [A, B],
  scores: { relax: 5, venue: 4, guidance: 3, transition: 2, again: 5 }, comment: '  Lovely weekend  ',
});

beforeEach(async () => { await pool.query('truncate event_feedback'); });
afterAll(async () => { await pool.query('truncate event_feedback'); });

describe('weekend feedback', () => {
  it('accepts a full form, and the transition question may be skipped', () => {
    expect(checkFeedback(good(), [A, B])).toEqual([]);
    const f = good(); delete f.scores.transition;
    expect(checkFeedback(f, [A, B])).toEqual([]);
  });

  it('lists every missing or bad answer', () => {
    const f: FeedbackInput = { name: ' ', email: 'nope', activityIds: [], scores: { relax: 6, transition: 0 }, comment: 'x'.repeat(2001) };
    expect(checkFeedback(f, [A])).toEqual(['name', 'email', 'activities', 'relax', 'venue', 'guidance', 'transition', 'again', 'comment']);
    expect(checkFeedback({ ...good(), activityIds: ['00000000-0000-4000-8000-000000000009'] }, [A, B])).toEqual(['activities']);
  });

  it('saves with a tidy email and comment, and limits forms per network', async () => {
    expect(await saveFeedback(good(), { personId: null, lang: 'zh', ipHash: 'net1' })).toBe('saved');
    const row = (await pool.query('select email, comment, activity_ids, transition, again from event_feedback')).rows[0];
    expect(row).toMatchObject({ email: 'mei@example.com', comment: 'Lovely weekend', activity_ids: [A, B], transition: 2, again: 5 });
    for (let i = 0; i < 9; i++) await saveFeedback(good(), { personId: null, lang: 'zh', ipHash: 'net1' });
    expect(await saveFeedback(good(), { personId: null, lang: 'zh', ipHash: 'net1' })).toBe('busy');
    expect(await saveFeedback(good(), { personId: null, lang: 'zh', ipHash: 'net2' })).toBe('saved');
  });
});
