import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { confirmBooking, holdSpots } from '@/lib/booking';
import { runReminders } from '@/lib/reminders';
import { outbox } from '@/lib/messaging';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();
const contact = { name: 'Jordan Lee', email: 'jordan@example.com', phone: '+14125550148' };

async function bookAt(minutesFromNow: number, remind = { remindSms: true, remindEmail: true }) {
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('Pottery Wheel', 'Barn Studio', 60) returning id`);
  const s = await pool.query<{ id: string }>(
    `insert into slots (activity_id, starts_at, capacity) values ($1, now() + make_interval(mins => $2), 10) returning id`,
    [a.rows[0].id, minutesFromNow],
  );
  const { holdId } = await holdSpots(s.rows[0].id, 2);
  return (await confirmBooking(holdId, { contact, ...remind })).bookingId;
}

beforeEach(async () => {
  await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade');
  outbox.length = 0;
});
afterAll(() => pool.end());

describe('15-minute reminders', () => {
  it('reminds only bookings starting within 15 minutes', async () => {
    await bookAt(14);
    await bookAt(40);
    const r = await runReminders();
    expect(r).toHaveLength(1);
    expect(outbox.filter((m) => m.subject?.startsWith('In 15 minutes'))).toHaveLength(1);
  });

  it('never sends the same reminder twice, even when runs overlap', async () => {
    await bookAt(10);
    const [a, b] = await Promise.all([runReminders(), runReminders()]);
    expect(a.length + b.length).toBe(1);
    expect(await runReminders()).toHaveLength(0);
  });

  it('falls back to email when texting is not set up', async () => {
    await bookAt(10, { remindSms: true, remindEmail: false });
    const [r] = await runReminders();
    expect(r.sent).toEqual(['email']);
  });

  it('skips people who opted out or already checked in', async () => {
    await bookAt(10, { remindSms: false, remindEmail: false });
    const id = await bookAt(12);
    await pool.query('update bookings set checked_in = 1 where id = $1', [id]);
    expect(await runReminders()).toHaveLength(0);
  });

  it('retries next run if sending fails', async () => {
    await bookAt(10);
    process.env.RESEND_API_KEY = 'bad';
    process.env.EMAIL_FROM = 'x@example.com';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    const [failed] = await runReminders();
    expect(failed.error).toMatch(/Email failed/);
    fetchSpy.mockRestore();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(await runReminders()).toHaveLength(1);
  });
});
