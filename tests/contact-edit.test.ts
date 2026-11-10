import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { confirmBooking, holdSpots } from '@/lib/booking';
import { staffUpdateContact, upcomingBookingIds } from '@/lib/staff';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();

async function signUp(contact: { name: string; email: string; phone: string | null }, remindSms = false, hoursAhead = 24) {
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('Tea Ceremony', 'Conference 1-2', 50) returning id`);
  const s = await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, now() + make_interval(hours => $2), 10) returning id`, [a.rows[0].id, hoursAhead]);
  const { holdId } = await holdSpots(s.rows[0].id, 1);
  return (await confirmBooking(holdId, { contact, remindSms, remindEmail: !remindSms })).bookingId;
}
const person = async (bookingId: string) =>
  (await pool.query('select p.name, p.email, p.phone from bookings b join people p on p.id = b.person_id where b.id = $1', [bookingId])).rows[0];

beforeEach(async () => { await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade'); });
afterAll(() => pool.end());

describe('staff: edit contact', () => {
  it('fixes a mistyped email for all of the person’s sign-ups', async () => {
    const a = await signUp({ name: 'Mei Lin', email: 'mei@gmial.com', phone: null });
    const b = await signUp({ name: 'Mei Lin', email: 'mei@gmial.com', phone: null }, false, 30);
    const r = await staffUpdateContact(a, { name: 'Mei Lin', email: 'mei@gmail.com', phone: null });
    expect(r).toMatchObject({ emailChanged: true, phoneChanged: false, smsOff: 0 });
    expect((await person(b)).email).toBe('mei@gmail.com');
    expect(await upcomingBookingIds(r!.personId)).toEqual([a, b]);
  });

  it('refuses when someone with that name and email already exists', async () => {
    const a = await signUp({ name: 'Mei Lin', email: 'mei@gmial.com', phone: null });
    await signUp({ name: 'mei lin', email: 'mei@gmail.com', phone: null }, false, 30);
    expect(await staffUpdateContact(a, { name: 'Mei Lin', email: 'MEI@gmail.com', phone: null })).toBeNull();
    expect((await person(a)).email).toBe('mei@gmial.com');
    // A different name on the same email (a household) is fine.
    expect(await staffUpdateContact(a, { name: 'Anna Lin', email: 'mei@gmail.com', phone: null })).not.toBeNull();
  });

  it('switches text reminders to email when the phone number changes', async () => {
    const a = await signUp({ name: 'Mei Lin', email: 'mei@example.com', phone: '+14125550148' }, true);
    const r = await staffUpdateContact(a, { name: 'Mei Lin', email: 'mei@example.com', phone: '+14125550199' });
    expect(r).toMatchObject({ phoneChanged: true, smsOff: 1 });
    expect((await pool.query('select remind_sms, remind_email from bookings where id = $1', [a])).rows[0]).toEqual({ remind_sms: false, remind_email: true });
    // Same number, only the name fixed: texts stay on.
    const b = await signUp({ name: 'Jo', email: 'jo@example.com', phone: '+14125550111' }, true, 30);
    expect(await staffUpdateContact(b, { name: 'Jo Chen', email: 'jo@example.com', phone: '+14125550111' })).toMatchObject({ phoneChanged: false, smsOff: 0 });
  });
});
