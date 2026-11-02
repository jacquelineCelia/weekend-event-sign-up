import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { activitiesAllDays, activityAllDays } from '@/lib/queries';
import { fmtDayTimeL } from '@/lib/event';

const pool = getPool();
let actId: string;

beforeEach(async () => {
  await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade');
  actId = (await pool.query<{ id: string }>(
    `insert into activities (name, place, duration_min) values ('A Sky Within', 'Atlantic Hall', 50) returning id`,
  )).rows[0].id;
  // Sat 2:50 PM, Sat 4:00 PM, Sun 9:50 AM, Sun 11:00 AM (New York), plus one outside the event.
  for (const t of ['2026-11-14 19:50+00', '2026-11-14 21:00+00', '2026-11-15 14:50+00', '2026-11-15 16:00+00', '2026-11-20 16:00+00']) {
    await pool.query('insert into slots (activity_id, starts_at, capacity) values ($1, $2, 80)', [actId, t]);
  }
});
afterAll(() => pool.end());

describe('whole weekend on one page', () => {
  it('lists both days of times, in order, and nothing outside the event', async () => {
    const [a] = await activitiesAllDays('en');
    expect(a.slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-11-14T19:50:00.000Z', '2026-11-14T21:00:00.000Z', '2026-11-15T14:50:00.000Z', '2026-11-15T16:00:00.000Z',
    ]);
    expect((await activityAllDays(actId, 'en'))!.slots).toHaveLength(4);
  });

  it('labels a time with its day in each language', () => {
    const sun = new Date('2026-11-15T14:50:00Z');
    expect(fmtDayTimeL(sun, 'en')).toBe('Sun 15 Nov, 9:50 AM');
    expect(fmtDayTimeL(sun, 'zh')).toBe('11/15（日）上午 9:50');
    expect(fmtDayTimeL(new Date('2026-11-20T16:00:00Z'), 'en')).toBe('11:00 AM');
  });
});
