import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { confirmBooking, holdSpots, walkInBooking } from '@/lib/booking';
import { contactSchema, walkInContactSchema } from '@/lib/contact';
import { registrationAt, saveSeating, seatTypesFor, setCheckedIn, startTimes } from '@/lib/staff';

const pool = getPool();
const T1 = new Date('2026-11-14T19:50:00Z');
const T2 = new Date('2026-11-14T21:00:00Z');
let tea: string, yoga: string, teaSlot: string, yogaSlot: string;

async function activity(name: string, order: number) {
  return (await pool.query<{ id: string }>(`insert into activities (name, place, duration_min, sort_order) values ($1, 'Hall', 50, $2) returning id`, [name, order])).rows[0].id;
}
const slot = async (act: string, at: Date, cap: number) =>
  (await pool.query<{ id: string }>('insert into slots (activity_id, starts_at, capacity) values ($1, $2, $3) returning id', [act, at, cap])).rows[0].id;

beforeEach(async () => {
  await pool.query('truncate ratings, booking_seats, seat_types, login_codes, bookings, people, slots, activities cascade');
  tea = await activity('Tea', 1);
  yoga = await activity('Yoga', 2);
  teaSlot = await slot(tea, T1, 10);
  yogaSlot = await slot(yoga, T1, 20);
  await slot(tea, T2, 10);
});
afterAll(() => pool.end());

describe('registration by time', () => {
  it('lists each start time with its totals', async () => {
    const { holdId } = await holdSpots(yogaSlot, 3);
    await confirmBooking(holdId, { contact: contactSchema.parse({ name: 'A', email: 'a@example.com', phone: '412 555 0100' }), remindSms: false, remindEmail: true });
    const times = await startTimes();
    expect(times.map((t) => [t.startsAt.toISOString(), t.activities, t.capacity, t.booked])).toEqual([
      [T1.toISOString(), 2, 30, 3],
      [T2.toISOString(), 1, 10, 0],
    ]);
    expect(times[0].endsAt.toISOString()).toBe('2026-11-14T20:40:00.000Z');
  });

  it('shows each activity at a time: booked, on hold, checked in, walk-ins and seating', async () => {
    expect(await saveSeating(tea, [{ id: null, name: 'High chair', nameZh: '', capacity: 4 }, { id: null, name: 'Ground seat', nameZh: '', capacity: 6 }])).toEqual({ ok: true });
    const [chair, ground] = (await seatTypesFor(tea)).map((s) => s.id);
    const { holdId } = await holdSpots(teaSlot, 3, [{ seatTypeId: chair, count: 1 }, { seatTypeId: ground, count: 2 }]);
    await confirmBooking(holdId, { contact: contactSchema.parse({ name: 'B', email: 'b@example.com', phone: '412 555 0101' }), remindSms: false, remindEmail: true });
    const w = await walkInBooking(teaSlot, 2, walkInContactSchema.parse({ name: 'W', phone: '412 555 0102', email: '' }), { seats: [{ seatTypeId: ground, count: 2 }] });
    await setCheckedIn(w.bookingId, 2);
    await holdSpots(teaSlot, 1, [{ seatTypeId: chair, count: 1 }]); // someone still typing their details

    const [teaRow, yogaRow] = await registrationAt(T1);
    expect(teaRow).toMatchObject({ activityName: 'Tea', capacity: 10, booked: 5, held: 1, arrived: 2, parties: 2, walkIns: 1 });
    expect(teaRow.seats).toEqual([{ name: 'High chair', nameZh: '', capacity: 4, booked: 1 }, { name: 'Ground seat', nameZh: '', capacity: 6, booked: 4 }]);
    expect(yogaRow).toMatchObject({ activityName: 'Yoga', booked: 0, held: 0, parties: 0, seats: [] });
  });
});
