import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { confirmBooking, holdSpots, walkInBooking } from '@/lib/booking';
import { contactSchema, walkInContactSchema } from '@/lib/contact';
import { startLogin } from '@/lib/login';
import { outbox } from '@/lib/messaging';
import { getBooking } from '@/lib/queries';
import { sendConfirmation, sendReminder } from '@/lib/notify';
import { saveSchedule, scheduleFor } from '@/lib/staff';

// Carrier rules for texting: only people who opted in get texts, the first text names the event
// and says how to stop, and a STOP reply switches that person to email.
vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();
let slotId: string;
let actId: string;
const DAY = '2026-11-14';
const PHONE = '(412) 555-0177';
const E164 = '+14125550177';
const mei = contactSchema.parse({ name: 'Mei Chen', email: 'mei@example.com', phone: PHONE });

// Pretend Twilio is set up; record every text the app tries to send.
let texts: { to: string; body: string }[] = [];
let twilioReply: () => Response = () => new Response('{"sid":"SM1"}', { status: 201 });
let fetchSpy: { mockRestore: () => void };

beforeEach(async () => {
  await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade');
  outbox.length = 0;
  texts = [];
  twilioReply = () => new Response('{"sid":"SM1"}', { status: 201 });
  process.env.TWILIO_ACCOUNT_SID = 'x'; process.env.TWILIO_AUTH_TOKEN = 'x'; process.env.TWILIO_FROM = 'MG123';
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const body = new URLSearchParams(String((init as RequestInit).body));
    texts.push({ to: body.get('To')!, body: body.get('Body')! });
    return twilioReply();
  });
  actId = (await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('Pottery Wheel', 'Barn Studio', 60) returning id`)).rows[0].id;
  slotId = (await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, '2026-11-14 16:30:00+00', 10) returning id`, [actId])).rows[0].id;
});
afterEach(() => {
  fetchSpy.mockRestore();
  delete process.env.TWILIO_ACCOUNT_SID; delete process.env.TWILIO_AUTH_TOKEN; delete process.env.TWILIO_FROM;
});
afterAll(() => pool.end());

const book = async (remindSms: boolean) => {
  const h = await holdSpots(slotId, 1);
  return confirmBooking(h.holdId, { contact: mei, remindSms, remindEmail: !remindSms });
};

describe('texting only with consent', () => {
  it('sends no texts to someone who did not tick "By text message"', async () => {
    const r = await book(false);
    const b = (await getBooking(r.bookingId))!;
    await sendConfirmation(b);
    await sendReminder(b);
    expect(texts).toEqual([]);
    expect(outbox.map((m) => m.channel)).toEqual(['email', 'email']);
  });

  it('texts a confirmation that names the event and says how to stop, when they opted in', async () => {
    const r = await book(true);
    await sendConfirmation((await getBooking(r.bookingId))!);
    expect(texts).toHaveLength(1);
    expect(texts[0].to).toBe(E164);
    expect(texts[0].body).toMatch(/^Mindfulness Weekend: Mei is in for Pottery Wheel, .* Msg frequency varies\. Msg & data rates may apply\. Reply HELP for help, STOP to opt out\.$/);
    expect(outbox.map((m) => m.channel)).toEqual(['email']); // the email confirmation still goes too
  });

  it('never texts walk-ins', async () => {
    const guest = walkInContactSchema.parse({ name: 'Walk In', phone: '412 555 0199', email: '' });
    const w = await walkInBooking(slotId, 1, guest);
    expect((await getBooking(w.bookingId))!.remindSms).toBe(false);
    await sendConfirmation((await getBooking(w.bookingId))!);
    expect(texts).toEqual([]);
  });

  it('tells about a time change by text only if they opted in, otherwise by email', async () => {
    await book(false);
    const [s] = await scheduleFor(actId, DAY);
    await saveSchedule(actId, DAY, [{ id: s.id, time: '13:00', capacity: 10 }]);
    expect(texts).toEqual([]);
    expect(outbox[0].channel).toBe('email');
  });

  it('sends sign-in codes by text only to numbers that opted in; others get email', async () => {
    const first = await book(false);
    const r1 = await startLogin(PHONE);
    expect(r1.via).toBe('email');
    expect(texts).toEqual([]);
    await pool.query(`update bookings set status = 'cancelled' where id = $1`, [first.bookingId]); // no overlapping sign-ups
    await book(true);
    const r2 = await startLogin(PHONE);
    expect(r2.via).toBe('sms');
    expect(texts[0].body).toMatch(/^Mindfulness Weekend: \d{6} is your sign-in code/);
  });
});

describe('someone replied STOP', () => {
  it('switches them to email reminders and stops texting', async () => {
    const r = await book(true);
    twilioReply = () => new Response('{"code":21610,"message":"Attempt to send to unsubscribed recipient"}', { status: 400 });
    const sent = await sendReminder((await getBooking(r.bookingId))!);
    expect(sent).toEqual(['email']);
    const after = (await getBooking(r.bookingId))!;
    expect(after.remindSms).toBe(false);
    expect(after.remindEmail).toBe(true);
    // Their next sign-in code goes by email.
    texts = [];
    expect((await startLogin(PHONE)).via).toBe('email');
    expect(texts).toEqual([]);
  });
});
