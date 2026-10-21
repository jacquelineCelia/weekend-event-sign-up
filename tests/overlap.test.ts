import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { BookingError, changeSlot, confirmBooking, holdSpots, walkInBooking } from '@/lib/booking';
import { contactSchema, walkInContactSchema } from '@/lib/contact';

const pool = getPool();

// Saturday Nov 14 (UTC): 15:00–16:00, 15:30–16:30 (overlaps), 16:00–17:00 (back to back), 15:00–16:00 on another activity.
let yoga: string, tea: string, walk: string, art: string;

async function makeSlot(name: string, startsAt: string, durationMin = 60, capacity = 10) {
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ($1, 'Here', $2) returning id`, [name, durationMin]);
  const s = await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, $2, $3) returning id`, [a.rows[0].id, startsAt, capacity]);
  return s.rows[0].id;
}
const jordan = contactSchema.parse({ name: 'Jordan Lee', email: 'jordan@example.com', phone: '(412) 555-0148' });
const sam = contactSchema.parse({ name: 'Sam Lee', email: 'sam@example.com', phone: '(412) 555-0148' });
const opts = { remindSms: false, remindEmail: true };

async function book(slotId: string, contact = jordan) {
  const { holdId } = await holdSpots(slotId, 1);
  return confirmBooking(holdId, { contact, ...opts });
}
const status = async (id: string) => (await pool.query<{ status: string }>('select status from bookings where id = $1', [id])).rows[0].status;

beforeEach(async () => {
  await pool.query('truncate ratings, bookings, people, slots, activities cascade');
  yoga = await makeSlot('Yoga', '2026-11-14 15:00:00+00');
  tea = await makeSlot('Tea', '2026-11-14 15:30:00+00');
  walk = await makeSlot('Walk', '2026-11-14 16:00:00+00');
  art = await makeSlot('Art', '2026-11-14 15:00:00+00', 30);
});
afterAll(() => pool.end());

describe('overlapping sign-ups', () => {
  it('refuses a sign-up that overlaps one the same person already has, naming it', async () => {
    const first = await book(yoga);
    const { holdId } = await holdSpots(tea, 1);
    const err = await confirmBooking(holdId, { contact: jordan, ...opts }).catch((e) => e);
    expect(err).toBeInstanceOf(BookingError);
    expect(err.code).toBe('overlap');
    expect(err.overlap.personId).toBe(first.personId);
    expect(err.overlap.conflicts.map((c: { bookingId: string }) => c.bookingId)).toEqual([first.bookingId]);
    expect(await status(holdId)).toBe('held'); // the hold is kept, so they can still choose
  });

  it('also catches a second sign-up for the very same time', async () => {
    await book(yoga);
    await expect(book(yoga)).rejects.toMatchObject({ code: 'overlap' });
  });

  it('allows back-to-back activities and activities that ended before', async () => {
    await book(yoga);
    await expect(book(walk)).resolves.toBeTruthy();
  });

  it('ignores cancelled sign-ups', async () => {
    const first = await book(yoga);
    await pool.query(`update bookings set status = 'cancelled' where id = $1`, [first.bookingId]);
    await expect(book(tea)).resolves.toBeTruthy();
  });

  it('lets different people on a shared phone sign up for the same time', async () => {
    await book(yoga, jordan);
    await expect(book(tea, sam)).resolves.toBeTruthy();
  });

  it('cancels the old sign-up and confirms the new one in one step when the owner asks', async () => {
    const first = await book(yoga);
    const { holdId } = await holdSpots(tea, 1);
    const r = await confirmBooking(holdId, { contact: jordan, ...opts, replace: { bookingIds: [first.bookingId], owners: [first.personId] } });
    expect(await status(first.bookingId)).toBe('cancelled');
    expect(await status(r.bookingId)).toBe('confirmed');
  });

  it('does not cancel anything unless the browser is signed in as that person', async () => {
    const first = await book(yoga);
    const other = await book(walk, sam);
    const { holdId } = await holdSpots(tea, 1);
    await expect(
      confirmBooking(holdId, { contact: jordan, ...opts, replace: { bookingIds: [first.bookingId], owners: [other.personId] } }),
    ).rejects.toMatchObject({ code: 'overlap' });
    expect(await status(first.bookingId)).toBe('confirmed');
  });

  it('only cancels the signer-up’s own sign-ups, even for a household', async () => {
    const samsYoga = await book(yoga, sam);
    const { holdId } = await holdSpots(tea, 1);
    // Signed in by the shared phone (both people), asking to cancel Sam's sign-up while booking for Jordan.
    await confirmBooking(holdId, { contact: jordan, ...opts, replace: { bookingIds: [samsYoga.bookingId], owners: [samsYoga.personId] } });
    expect(await status(samsYoga.bookingId)).toBe('confirmed');
  });

  it('cancels nothing if another clash would remain', async () => {
    const first = await book(yoga);
    const second = await book(walk);
    const { holdId } = await holdSpots(await makeSlot('Long hike', '2026-11-14 15:00:00+00', 120), 1);
    await expect(
      confirmBooking(holdId, { contact: jordan, ...opts, replace: { bookingIds: [first.bookingId], owners: [first.personId] } }),
    ).rejects.toMatchObject({ code: 'overlap' });
    expect(await status(first.bookingId)).toBe('confirmed');
    expect(await status(second.bookingId)).toBe('confirmed');
  });

  it('finds clashes with a shorter activity that starts at the same time', async () => {
    await book(art);
    await expect(book(yoga)).rejects.toMatchObject({ code: 'overlap' });
  });
});

describe('overlaps when changing time and for walk-ins', () => {
  it('won’t move a sign-up onto a time that overlaps another of the same person’s', async () => {
    const yogaB = await book(yoga);
    const walkB = await book(walk);       // 16:00–17:00, back to back with yoga
    await expect(changeSlot(walkB.bookingId, walkB.personId, tea)).rejects.toMatchObject({ code: 'overlap' }); // tea 15:30 overlaps yoga
    const lateTea = await makeSlot('Late tea', '2026-11-14 18:00:00+00');
    await expect(changeSlot(yogaB.bookingId, yogaB.personId, tea)).rejects.toMatchObject({ code: 'overlap' }); // tea runs into the 16:00 walk
    await expect(changeSlot(yogaB.bookingId, yogaB.personId, art)).resolves.toBeUndefined(); // 15:00–15:30 overlaps only yoga itself
    await expect(changeSlot(walkB.bookingId, walkB.personId, lateTea)).resolves.toBeUndefined();
  });

  it('refuses a walk-in for someone already signed up at an overlapping time, unless staff cancel it', async () => {
    const first = await book(yoga);
    const walkInJordan = walkInContactSchema.parse({ name: 'Jordan Lee', phone: '412 555 0148', email: 'jordan@example.com' });
    const err = await walkInBooking(tea, 1, walkInJordan).catch((e) => e);
    expect(err).toMatchObject({ code: 'overlap', overlap: { personId: first.personId } });
    expect(err.overlap.conflicts.map((c: { bookingId: string }) => c.bookingId)).toEqual([first.bookingId]);
    const r = await walkInBooking(tea, 1, walkInJordan, { replace: [first.bookingId] });
    expect(r.personId).toBe(first.personId);
    expect(await status(first.bookingId)).toBe('cancelled');
  });

  it('matches walk-ins without email by phone and name', async () => {
    await book(yoga);
    await expect(walkInBooking(tea, 1, walkInContactSchema.parse({ name: 'jordan lee', phone: '412 555 0148', email: '' }))).rejects.toMatchObject({ code: 'overlap' });
    await expect(walkInBooking(tea, 1, walkInContactSchema.parse({ name: 'Riley Lee', phone: '412 555 0148', email: '' }))).resolves.toBeTruthy();
  });
});
