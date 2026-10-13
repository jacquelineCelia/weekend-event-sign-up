import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getPool } from '@/lib/db';
import { confirmBooking, holdSpots } from '@/lib/booking';
import { contactSchema } from '@/lib/contact';
import { outbox } from '@/lib/messaging';
import { saveSchedule, scheduleFor } from '@/lib/staff';

const pool = getPool();
const DAY = '2026-11-14';
let actId: string;
const guest = contactSchema.parse({ name: 'Sam Rivera', email: 'sam@example.com', phone: '412 555 0199' });

beforeEach(async () => {
  await pool.query('truncate ratings, bookings, people, slots, activities cascade');
  outbox.length = 0;
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('Forest bathing', 'Cedar trail', 60) returning id`);
  actId = a.rows[0].id;
  // 10:00 and 12:00 New York time
  await pool.query(`insert into slots (activity_id, starts_at, capacity) values ($1, '2026-11-14 15:00:00+00', 10), ($1, '2026-11-14 17:00:00+00', 8)`, [actId]);
});
afterAll(() => pool.end());

const book = async (slotId: string, n: number) => {
  const h = await holdSpots(slotId, n);
  return confirmBooking(h.holdId, { contact: guest, remindSms: false, remindEmail: true });
};

describe('schedule editor', () => {
  it('reads slots in event-local time', async () => {
    const s = await scheduleFor(actId, DAY);
    expect(s.map((x) => [x.time, x.capacity, x.booked])).toEqual([['10:00', 10, 0], ['12:00', 8, 0]]);
  });

  it('adds, edits and deletes slots in one save', async () => {
    const [a, b] = await scheduleFor(actId, DAY);
    const r = await saveSchedule(actId, DAY, [
      { id: a.id, time: '09:30', capacity: 12 },
      { id: null, time: '14:00', capacity: 6 },
    ]);
    expect(r).toEqual({ notified: 0 });
    const s = await scheduleFor(actId, DAY);
    expect(s.map((x) => [x.time, x.capacity])).toEqual([['09:30', 12], ['14:00', 6]]);
    expect(s.find((x) => x.id === b.id)).toBeUndefined();
  });

  it('swaps two slot times without tripping the unique constraint', async () => {
    const [a, b] = await scheduleFor(actId, DAY);
    const r = await saveSchedule(actId, DAY, [{ id: a.id, time: '12:00', capacity: 10 }, { id: b.id, time: '10:00', capacity: 8 }]);
    expect(r).toEqual({ notified: 0 });
  });

  it('rejects overlaps, capacity below bookings, and deleting booked slots — without partial writes', async () => {
    const [a, b] = await scheduleFor(actId, DAY);
    await book(b.id, 3);
    expect(await saveSchedule(actId, DAY, [{ id: a.id, time: '10:00', capacity: 10 }, { id: b.id, time: '10:30', capacity: 8 }]))
      .toMatchObject({ error: expect.stringContaining('overlap') });
    expect(await saveSchedule(actId, DAY, [{ id: a.id, time: '10:00', capacity: 10 }, { id: b.id, time: '12:00', capacity: 2 }]))
      .toMatchObject({ error: expect.stringContaining("can't go below") });
    expect(await saveSchedule(actId, DAY, [{ id: null, time: '15:00', capacity: 5 }]))
      .toMatchObject({ error: expect.stringContaining("can't be deleted") });
    const s = await scheduleFor(actId, DAY);
    expect(s.map((x) => [x.time, x.capacity, x.booked])).toEqual([['10:00', 10, 0], ['12:00', 8, 3]]);
  });

  it('tells booked guests when their slot moves and re-arms the reminder', async () => {
    const [, b] = await scheduleFor(actId, DAY);
    const booking = await book(b.id, 2);
    await pool.query('update bookings set reminder_sent_at = now() where id = $1', [booking.bookingId]);
    outbox.length = 0;
    const r = await saveSchedule(actId, DAY, [{ id: b.id, time: '13:00', capacity: 8 }]);
    expect(r).toEqual({ notified: 1 });
    expect(outbox).toHaveLength(1);
    expect(outbox[0].text).toContain('1:00 PM');
    const row = await pool.query('select reminder_sent_at from bookings where id = $1', [booking.bookingId]);
    expect(row.rows[0].reminder_sent_at).toBeNull();
  });
});
