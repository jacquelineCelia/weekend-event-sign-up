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
