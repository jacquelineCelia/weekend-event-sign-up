import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { confirmBooking, holdSpots, staffCancelBooking } from '@/lib/booking';
import { attendees } from '@/lib/staff';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();

async function signUp(name: string, email: string, act: string, hours: number, party = 1) {
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ($1, 'Hall', 50) returning id`, [act]);
  const s = await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, now() + make_interval(hours => $2), 10) returning id`, [a.rows[0].id, hours]);
  const { holdId } = await holdSpots(s.rows[0].id, party);
  return (await confirmBooking(holdId, { contact: { name, email, phone: null }, remindSms: false, remindEmail: true })).bookingId;
}

beforeEach(async () => { await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade'); });
afterAll(() => pool.end());

describe('staff: attendees list', () => {
  it('lists each person once with their current sign-ups in time order', async () => {
    await signUp('Mei Lin', 'mei@example.com', 'Yoga', 30, 2);
    await signUp('Mei Lin', 'mei@example.com', 'Tea', 24);
    const gone = await signUp('Ann Chen', 'ann@example.com', 'Walk', 26);
    await signUp('Ann Chen', 'ann@example.com', 'Stars', 28);
    await staffCancelBooking(gone);
    const list = await attendees();
    expect(list.map((p) => [p.name, p.signups.map((s) => `${s.activityName}×${s.partySize}`)])).toEqual([
      ['Ann Chen', ['Stars×1']],
      ['Mei Lin', ['Tea×1', 'Yoga×2']],
    ]);
  });
});

describe('Attendees search and filter (shared by the list and the CSV)', () => {
  const mei = { name: 'Mei Lin', email: 'mei@example.com', phone: '+14125550148', signups: [
    { code: '54D2', find: 'walk into the light 散步 散步' },
    { code: '9R9V', find: 'savor the now 覺察・靜心茶席 觉察・静心茶席' },
  ] };
  it('keeps every sign-up when the person matches', async () => {
    const { matchSignups } = await import('@/lib/people-filter');
    expect(matchSignups(mei, 'mei', null)).toHaveLength(2);
    expect(matchSignups(mei, '0148', null)).toHaveLength(2);
    expect(matchSignups(mei, '9r9v', null)).toHaveLength(2);
    expect(matchSignups(mei, '', 2)).toHaveLength(2);
  });
  it('keeps only the matching activity when the search names one', async () => {
    const { matchSignups } = await import('@/lib/people-filter');
    expect(matchSignups(mei, '散步', null)?.map((s) => s.code)).toEqual(['54D2']);
    expect(matchSignups(mei, '静心', null)?.map((s) => s.code)).toEqual(['9R9V']);
    expect(matchSignups(mei, 'yoga', null)).toBeNull();
    expect(matchSignups(mei, '散步', 1)).toBeNull(); // Mei has 2 activities
  });
});
