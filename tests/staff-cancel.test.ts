import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { confirmBooking, holdSpots, staffCancelBooking } from '@/lib/booking';
import { sendCancellation } from '@/lib/notify';
import { getBooking } from '@/lib/queries';
import { outbox } from '@/lib/messaging';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();

async function signUp(email: string | null, lang: 'zh' | 'en' = 'zh') {
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min, name_zh) values ('Tea Ceremony', 'Conference 1-2', 50, '靜心茶席') returning id`);
  const s = await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, now() + interval '1 day', 10) returning id`, [a.rows[0].id]);
  const { holdId } = await holdSpots(s.rows[0].id, 3);
  const contact = { name: 'Mei Lin', email: email ?? 'x@example.com', phone: null };
  const { bookingId } = await confirmBooking(holdId, { contact, remindSms: false, remindEmail: true, lang });
  return { bookingId, slotId: s.rows[0].id };
}

beforeEach(async () => {
  await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade');
  outbox.length = 0;
});
afterAll(() => pool.end());

describe('staff: cancel a sign-up', () => {
  it('cancels once and frees the spots', async () => {
    const { bookingId, slotId } = await signUp('mei@example.com');
    expect(await staffCancelBooking(bookingId)).toBe(true);
    expect(await staffCancelBooking(bookingId)).toBe(false);
    const left = await pool.query(`select coalesce(sum(party_size) filter (where status = 'confirmed'), 0)::int as n from bookings where slot_id = $1`, [slotId]);
    expect(left.rows[0].n).toBe(0);
    // The spots can be taken again.
    await expect(holdSpots(slotId, 10)).resolves.toBeTruthy();
  });

  it('emails the person in their language', async () => {
    const { bookingId } = await signUp('mei@example.com');
    outbox.length = 0; // the booking confirmation
    await staffCancelBooking(bookingId);
    expect(await sendCancellation((await getBooking(bookingId))!)).toBe(true);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].subject).toBe('報名已取消：「靜心茶席」');
    expect(outbox[0].text).toContain('已由工作人員取消');
  });
});
