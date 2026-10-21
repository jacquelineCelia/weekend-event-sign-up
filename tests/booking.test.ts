import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { BookingError, cancelBooking, changeSlot, confirmBooking, holdSpots, releaseHold, walkInBooking } from '@/lib/booking';
import { contactSchema, normalizePhone } from '@/lib/contact';

const pool = getPool();
let slotId: string;
let otherSlotId: string;

async function makeSlot(capacity: number, startsAt = '2026-11-14 15:00:00+00') {
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('Test', 'Here', 60) returning id`);
  const s = await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, $2, $3) returning id`, [a.rows[0].id, startsAt, capacity]);
  return s.rows[0].id;
}
const remaining = async (id: string) => (await pool.query<{ remaining: number }>('select remaining from slot_availability where slot_id = $1', [id])).rows[0].remaining;
const jordan = contactSchema.parse({ name: 'Jordan Lee', email: 'Jordan@Example.com', phone: '(412) 555-0148' });

beforeEach(async () => {
  await pool.query('truncate ratings, bookings, people, slots, activities cascade');
  slotId = await makeSlot(10);
  otherSlotId = await makeSlot(4, '2026-11-14 17:00:00+00');
});
afterAll(() => pool.end());

describe('contact details', () => {
  it('normalises phone numbers and email', () => {
    expect(normalizePhone('(412) 555-0148')).toBe('+14125550148');
    expect(normalizePhone('1-412-555-0148')).toBe('+14125550148');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhone('555')).toBeNull();
    expect(jordan).toEqual({ name: 'Jordan Lee', email: 'jordan@example.com', phone: '+14125550148' });
  });
  it('requires name, email and phone for online sign-ups', () => {
    const r = contactSchema.safeParse({ name: '', email: 'nope', phone: '' });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0]).sort()).toEqual(['email', 'name', 'phone']);
  });
});

describe('holds and confirmation', () => {
  it('holds spots, confirms, and gives a 4-character code', async () => {
    const { holdId } = await holdSpots(slotId, 3);
    expect(await remaining(slotId)).toBe(7);
    const { code } = await confirmBooking(holdId, { contact: jordan, remindSms: true, remindEmail: true });
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    expect(await remaining(slotId)).toBe(7);
  });

  it('refuses a party bigger than what is left', async () => {
    await holdSpots(slotId, 8);
    await expect(holdSpots(slotId, 3)).rejects.toMatchObject({ code: 'not_enough_spots', remaining: 2 });
  });

  it('frees the spots when a hold expires or is released', async () => {
    const { holdId } = await holdSpots(slotId, 10);
    expect(await remaining(slotId)).toBe(0);
    await pool.query(`update bookings set hold_expires_at = now() - interval '1 second' where id = $1`, [holdId]);
    expect(await remaining(slotId)).toBe(10);
    const h2 = await holdSpots(slotId, 4);
    await releaseHold(h2.holdId);
    expect(await remaining(slotId)).toBe(10);
  });

  it('still confirms a lapsed hold if the spots are free', async () => {
    const { holdId } = await holdSpots(slotId, 2);
    await pool.query(`update bookings set hold_expires_at = now() - interval '1 minute' where id = $1`, [holdId]);
    await expect(confirmBooking(holdId, { contact: jordan, remindSms: true, remindEmail: true })).resolves.toHaveProperty('code');
  });

  it('refuses a lapsed hold whose spots were taken', async () => {
    const { holdId } = await holdSpots(slotId, 2);
    await pool.query(`update bookings set hold_expires_at = now() - interval '1 minute' where id = $1`, [holdId]);
    await holdSpots(slotId, 9);
    await expect(confirmBooking(holdId, { contact: jordan, remindSms: true, remindEmail: true })).rejects.toMatchObject({ code: 'hold_expired' });
  });

  it('cannot confirm the same hold twice', async () => {
    const { holdId } = await holdSpots(slotId, 1);
    await confirmBooking(holdId, { contact: jordan, remindSms: true, remindEmail: true });
    await expect(confirmBooking(holdId, { contact: jordan, remindSms: true, remindEmail: true })).rejects.toBeInstanceOf(BookingError);
  });

  it('reuses the same person for a returning attendee', async () => {
    const a = await confirmBooking((await holdSpots(slotId, 1)).holdId, { contact: jordan, remindSms: true, remindEmail: true });
    const b = await confirmBooking((await holdSpots(otherSlotId, 1)).holdId, {
      contact: { ...jordan, name: 'Jordan L.' },
      remindSms: false,
      remindEmail: true,
    });
    expect(b.personId).toBe(a.personId);
    const p = await pool.query('select count(*)::int n from people');
    expect(p.rows[0].n).toBe(1);
  });
});

describe('capacity under load', () => {
  it('never oversells when 30 people race for 10 spots', async () => {
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => holdSpots(slotId, 1)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
    expect(await remaining(slotId)).toBe(0);
  });

  it('never oversells with mixed party sizes', async () => {
    const sizes = [3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2];
    await Promise.allSettled(sizes.map((n) => holdSpots(slotId, n)));
    const taken = await pool.query<{ t: number }>(`select coalesce(sum(party_size),0)::int t from bookings where slot_id = $1 and status = 'held'`, [slotId]);
    expect(taken.rows[0].t).toBeLessThanOrEqual(10);
  });
});

describe('changes after booking', () => {
  it('cancelling frees the spots', async () => {
    const { holdId } = await holdSpots(slotId, 4);
    const { bookingId, personId } = await confirmBooking(holdId, { contact: jordan, remindSms: true, remindEmail: true });
    await cancelBooking(bookingId, personId);
    expect(await remaining(slotId)).toBe(10);
  });

  it('moves a booking only if the new time has room', async () => {
    const { bookingId, personId } = await confirmBooking((await holdSpots(slotId, 3)).holdId, { contact: jordan, remindSms: true, remindEmail: true });
    await holdSpots(otherSlotId, 2);
    await expect(changeSlot(bookingId, personId, otherSlotId)).rejects.toMatchObject({ code: 'not_enough_spots', remaining: 2 });
    await pool.query(`update slots set capacity = 6 where id = $1`, [otherSlotId]);
    await changeSlot(bookingId, personId, otherSlotId);
    expect(await remaining(slotId)).toBe(10);
    expect(await remaining(otherSlotId)).toBe(1);
  });

  it('walk-ins respect capacity unless a lead approves going over', async () => {
    const walker = { name: 'Morgan Ellis', email: null, phone: '+14125550193' };
    await walkInBooking(otherSlotId, 3, walker, { checkInNow: true });
    // Different people: one person can't hold two sign-ups at the same time.
    const friend = { name: 'Sam Ellis', email: null, phone: '+14125550194' };
    await expect(walkInBooking(otherSlotId, 2, friend)).rejects.toMatchObject({ code: 'not_enough_spots' });
    await expect(walkInBooking(otherSlotId, 2, friend, { allowOver: true })).resolves.toHaveProperty('code');
  });
});
