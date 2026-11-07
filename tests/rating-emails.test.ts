import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { confirmBooking, holdSpots } from '@/lib/booking';
import { runRatingEmails } from '@/lib/reminders';
import { outbox } from '@/lib/messaging';
import { rateToken, readRateToken } from '@/lib/rate-link';
import { saveRating } from '@/lib/ratings';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();
let n = 0;

/** A confirmed sign-up for a 60-minute activity that ended `endedMinutesAgo` minutes ago. */
async function signUp(endedMinutesAgo: number, opts: { checkedIn?: number } = {}) {
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min, name_zh) values ('Tea Ceremony', 'Conference 1-2', 60, '靜心茶席') returning id`);
  const s = await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, now() + interval '1 day', 10) returning id`, [a.rows[0].id]);
  const { holdId } = await holdSpots(s.rows[0].id, 2);
  const contact = { name: 'Mei Lin', email: `mei+${++n}@example.com`, phone: '+14125550148' };
  const { bookingId } = await confirmBooking(holdId, { contact, remindSms: false, remindEmail: true, lang: 'zh' });
  await pool.query(`update slots set starts_at = now() - make_interval(mins => $2) where id = $1`, [s.rows[0].id, 60 + endedMinutesAgo]);
  await pool.query('update bookings set checked_in = $2 where id = $1', [bookingId, opts.checkedIn ?? 2]);
  return bookingId;
}

beforeEach(async () => {
  await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade');
  outbox.length = 0;
});
afterAll(() => pool.end());

describe('"How was it?" emails', () => {
  it('emails checked-in attendees once, after the activity ends, with a link to rate it', async () => {
    const id = await signUp(1);
    outbox.length = 0; // the booking confirmation
    expect((await runRatingEmails()).map((r) => r.id)).toEqual([id]);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].subject).toBe('體驗回饋：「靜心茶席」');
    const link = outbox[0].text.match(/\/zh\/rate\/(\S+)/);
    expect(link).not.toBeNull();
    expect(readRateToken(link![1])).toBe(id);
    expect(await runRatingEmails()).toEqual([]); // only once
  });

  it('skips sign-ups that are not over, not checked in, long past, or already rated', async () => {
    await signUp(-5); // ends in 5 minutes
    await signUp(1, { checkedIn: 0 });
    await signUp(200); // ended over 3 hours ago
    const rated = await signUp(1);
    await saveRating(rated, { column: 'calm', value: 4 }, null);
    await saveRating(rated, { column: 'again', value: true }, null);
    const halfRated = await signUp(1);
    await saveRating(halfRated, { column: 'calm', value: 3 }, null);
    expect((await runRatingEmails()).map((r) => r.id)).toEqual([halfRated]);
  });
});

describe('rating links', () => {
  const id = '6f1c2a5e-8b4d-4c3e-9a7f-1d2e3f4a5b6c';
  it('open only the sign-up they were made for, and expire', () => {
    const t = rateToken(id);
    expect(t).not.toContain('.');
    expect(readRateToken(t)).toBe(id);
    expect(readRateToken(t.slice(0, -2) + 'xx')).toBeNull();
    const other = rateToken('00000000-0000-4000-8000-000000000001');
    expect(readRateToken(`${t.split('~')[0]}~${other.split('~')[1]}`)).toBeNull();
    expect(readRateToken(t, Date.now() + 61 * 86400 * 1000)).toBeNull();
    expect(readRateToken('nonsense')).toBeNull();
  });

  it('save a rating without signing in, but only once the activity has started', async () => {
    const past = await signUp(1);
    await saveRating(past, { column: 'calm', value: 5 }, null);
    expect((await pool.query('select calm from ratings where booking_id = $1', [past])).rows[0].calm).toBe(5);
    const future = await signUp(-120);
    await saveRating(future, { column: 'calm', value: 5 }, null);
    expect((await pool.query('select count(*)::int as n from ratings where booking_id = $1', [future])).rows[0].n).toBe(0);
  });
});
