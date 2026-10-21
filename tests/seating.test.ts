import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { changeSlot, confirmBooking, holdSpots, walkInBooking } from '@/lib/booking';
import { contactSchema, walkInContactSchema } from '@/lib/contact';
import { getBooking, seatOptions } from '@/lib/queries';
import { roster, saveSchedule, saveSeating, seatTypesFor } from '@/lib/staff';

const pool = getPool();
let actId: string, slotA: string, slotB: string, chair: string, ground: string;
const DAY = '2026-11-14';
const opts = { remindSms: false, remindEmail: true };
let n = 0;
const someone = () => contactSchema.parse({ name: 'Guest', email: `guest${++n}@example.com`, phone: '412 555 0100' });
const capacity = async (id: string) => (await pool.query<{ capacity: number }>('select capacity from slots where id = $1', [id])).rows[0].capacity;

beforeEach(async () => {
  await pool.query('truncate ratings, booking_seats, seat_types, bookings, people, slots, activities cascade');
  actId = (await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('Tea Ceremony', 'Tea House', 60) returning id`)).rows[0].id;
  const slot = async (t: string) => (await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, $2, 99) returning id`, [actId, `${DAY} ${t}:00-05`])).rows[0].id;
  slotA = await slot('14:00');
  slotB = await slot('16:00');
  expect(await saveSeating(actId, [
    { id: null, name: 'High chair', nameZh: '椅子座位', capacity: 2 },
    { id: null, name: 'Ground seat', nameZh: '席地座位', capacity: 4 },
  ])).toEqual({ ok: true });
  const types = await seatTypesFor(actId);
  [chair, ground] = types.map((t) => t.id);
});
afterAll(() => pool.end());

const book = async (slot: string, c: number, g: number) => {
  const seats = [{ seatTypeId: chair, count: c }, { seatTypeId: ground, count: g }];
  const { holdId } = await holdSpots(slot, c + g, seats);
  return confirmBooking(holdId, { contact: someone(), ...opts });
};

describe('seating', () => {
  it('sets every slot’s capacity to the seat total', async () => {
    expect(await capacity(slotA)).toBe(6);
    expect(await capacity(slotB)).toBe(6);
  });

  it('books a party split across seat types and shows it on the booking and the roster', async () => {
    const r = await book(slotA, 1, 2);
    const b = (await getBooking(r.bookingId))!;
    expect(b.partySize).toBe(3);
    expect(b.seats).toEqual([{ name: 'High chair', nameZh: '椅子座位', count: 1 }, { name: 'Ground seat', nameZh: '席地座位', count: 2 }]);
    expect((await roster(slotA))[0].seats).toBe('High chair × 1, Ground seat × 2');
  });

  it('needs a seat for everyone, from this activity', async () => {
    await expect(holdSpots(slotA, 2)).rejects.toMatchObject({ code: 'seats_needed' });
    await expect(holdSpots(slotA, 3, [{ seatTypeId: chair, count: 1 }, { seatTypeId: ground, count: 1 }])).rejects.toMatchObject({ code: 'seats_needed' });
    const other = (await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('X', 'Y', 30) returning id`)).rows[0].id;
    const foreign = (await pool.query<{ id: string }>(`insert into seat_types (activity_id, name, capacity) values ($1, 'Bench', 5) returning id`, [other])).rows[0].id;
    await expect(holdSpots(slotA, 1, [{ seatTypeId: foreign, count: 1 }])).rejects.toMatchObject({ code: 'seats_needed' });
  });

  it('keeps each seat type within its own capacity, counting holds', async () => {
    await holdSpots(slotA, 2, [{ seatTypeId: chair, count: 2 }]);
    await expect(holdSpots(slotA, 1, [{ seatTypeId: chair, count: 1 }])).rejects.toMatchObject({ code: 'seats_taken', remaining: 0 });
    await expect(holdSpots(slotA, 4, [{ seatTypeId: ground, count: 4 }])).resolves.toBeTruthy();
    // The other slot is separate.
    await expect(holdSpots(slotB, 2, [{ seatTypeId: chair, count: 2 }])).resolves.toBeTruthy();
    const opt = await seatOptions(actId, [slotA, slotB]);
    expect(opt.map((o) => [o.name, o.left[slotA], o.left[slotB]])).toEqual([['High chair', 0, 0], ['Ground seat', 0, 4]]);
  });

  it('re-checks seats when an expired hold is confirmed', async () => {
    const { holdId } = await holdSpots(slotA, 2, [{ seatTypeId: chair, count: 2 }]);
    await pool.query(`update bookings set hold_expires_at = now() - interval '1 second' where id = $1`, [holdId]);
    await book(slotA, 1, 0);
    await expect(confirmBooking(holdId, { contact: someone(), ...opts })).rejects.toMatchObject({ code: 'hold_expired' });
  });

  it('moves a sign-up only to a time with the same seats free', async () => {
    const r = await book(slotA, 2, 0);
    await book(slotB, 1, 0);
    await expect(changeSlot(r.bookingId, r.personId, slotB)).rejects.toMatchObject({ code: 'seats_taken' });
    const g = await book(slotA, 0, 3);
    await expect(changeSlot(g.bookingId, g.personId, slotB)).resolves.toBeUndefined();
  });

  it('walk-ins choose seats; a lead can approve going over', async () => {
    const guest = walkInContactSchema.parse({ name: 'Walk In', phone: '412 555 0199', email: '' });
    await walkInBooking(slotA, 2, guest, { seats: [{ seatTypeId: chair, count: 2 }] });
    await expect(walkInBooking(slotA, 1, guest, { seats: [{ seatTypeId: chair, count: 1 }] })).rejects.toMatchObject({ code: 'seats_taken' });
    await expect(walkInBooking(slotA, 1, guest, { seats: [{ seatTypeId: chair, count: 1 }], allowOver: true })).resolves.toBeTruthy();
    await expect(walkInBooking(slotA, 1, guest)).rejects.toMatchObject({ code: 'seats_needed' });
  });

  it('staff can’t cut a seat type below what’s booked, or remove one that’s been chosen', async () => {
    await book(slotA, 2, 1);
    const [c, g] = await seatTypesFor(actId);
    expect(c.minCapacity).toBe(2);
    expect(await saveSeating(actId, [{ ...c, capacity: 1 }, g])).toMatchObject({ error: expect.stringContaining('High chair') });
    expect(await saveSeating(actId, [c])).toMatchObject({ error: expect.stringContaining('Ground seat') });
    expect(await saveSeating(actId, [{ ...c, capacity: 3 }, { ...g, capacity: 7 }])).toEqual({ ok: true });
    expect(await capacity(slotA)).toBe(10);
  });

  it('schedule edits keep slot capacity at the seat total', async () => {
    await saveSchedule(actId, DAY, [{ id: slotA, time: '14:00', capacity: 50 }, { id: slotB, time: '16:00', capacity: 1 }, { id: null, time: '18:00', capacity: 3 }]);
    const caps = (await pool.query<{ capacity: number }>('select capacity from slots where activity_id = $1', [actId])).rows.map((r) => r.capacity);
    expect(caps).toEqual([6, 6, 6]);
  });

  it('activities without seat types work as before', async () => {
    const plain = (await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('Yoga', 'Meadow', 45) returning id`)).rows[0].id;
    const s = (await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, '${DAY} 08:00:00-05', 5) returning id`, [plain])).rows[0].id;
    const { holdId } = await holdSpots(s, 3);
    const r = await confirmBooking(holdId, { contact: someone(), ...opts });
    expect((await getBooking(r.bookingId))!.seats).toEqual([]);
  });
});
