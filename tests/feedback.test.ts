import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { checkFeedback, saveFeedback, type FeedbackInput } from '@/lib/feedback';
import { CEREMONY } from '@/lib/feedback-questions';

const pool = getPool();
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const ceremony = () => Object.fromEntries(CEREMONY.map((k, i) => [k, (i % 5) + 1]));
const good = (): FeedbackInput => ({
  name: 'Mei Lin', email: 'Mei@Example.com', age: '60s', toGuru: '  感恩  ',
  scores: { ...ceremony(), relax: 5, venue: 4, guidance: 3, transition: 2, again: 5 },
  noActivities: false, activityIds: [A, B], comment: '  Lovely weekend  ',
});

beforeEach(async () => { await pool.query('truncate event_feedback'); });
afterAll(async () => { await pool.query('truncate event_feedback'); });

describe('feedback (法會 and activities)', () => {
  it('accepts a full form, and the transition question may be skipped', () => {
    expect(checkFeedback(good(), [A, B])).toEqual([]);
    const f = good(); delete f.scores.transition;
    expect(checkFeedback(f, [A, B])).toEqual([]);
  });

  it('lists every missing or bad answer, in page order', () => {
    const f: FeedbackInput = {
      name: ' ', email: 'nope', age: '20s', toGuru: 'x'.repeat(2001), scores: { joy: 6, relax: 6, transition: 0 },
      noActivities: false, activityIds: [], comment: 'x'.repeat(2001),
    };
    expect(checkFeedback(f, [A])).toEqual(['name', 'email', 'age', 'toGuru', ...CEREMONY, 'activities', 'relax', 'venue', 'guidance', 'transition', 'again', 'comment']);
    expect(checkFeedback({ ...good(), activityIds: ['00000000-0000-4000-8000-000000000009'] }, [A, B])).toEqual(['activities']);
  });

  it('with "didn\'t join any activities", needs no activities or activity scores', () => {
    const f: FeedbackInput = { ...good(), noActivities: true, activityIds: [], scores: ceremony() };
    expect(checkFeedback(f, [A, B])).toEqual([]);
  });

  it('saves every answer with a tidy email and text, and limits forms per network', async () => {
    expect(await saveFeedback(good(), { personId: null, lang: 'zh', ipHash: 'net1' })).toBe('saved');
    const row = (await pool.query('select * from event_feedback')).rows[0];
    expect(row).toMatchObject({
      email: 'mei@example.com', age: '60s', to_guru: '感恩', comment: 'Lovely weekend', activity_ids: [A, B],
      joy: 1, learn_talks: 2, learn_chant: 5, sat_moving: 1, sat_volunteers: 1, transition: 2, again: 5, no_activities: false,
    });
    for (let i = 0; i < 9; i++) await saveFeedback(good(), { personId: null, lang: 'zh', ipHash: 'net1' });
    expect(await saveFeedback(good(), { personId: null, lang: 'zh', ipHash: 'net1' })).toBe('busy');
    expect(await saveFeedback(good(), { personId: null, lang: 'zh', ipHash: 'net2' })).toBe('saved');
  });

  it('saves a form without activities with the activity scores blank', async () => {
    await saveFeedback({ ...good(), noActivities: true }, { personId: null, lang: 'en', ipHash: '' });
    const row = (await pool.query('select no_activities, activity_ids, relax, again, sat_food from event_feedback')).rows[0];
    expect(row).toEqual({ no_activities: true, activity_ids: [], relax: null, again: null, sat_food: 5 });
  });
});
