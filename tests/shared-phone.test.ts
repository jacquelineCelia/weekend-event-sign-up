import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { cancelBooking, confirmBooking, holdSpots, walkInBooking } from '@/lib/booking';
import { contactSchema, walkInContactSchema } from '@/lib/contact';
import { startLogin, verifyLogin } from '@/lib/login';
import { outbox } from '@/lib/messaging';
import { decodeViewer, encodeSession } from '@/lib/session';
import { viewerPersonIds } from '@/lib/viewer';
import { getBooking } from '@/lib/queries';
import { sendReminder } from '@/lib/notify';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();
let slotId: string;
const PHONE = '(412) 555-0100';
const E164 = '+14125550100';

const anna = contactSchema.parse({ name: 'Anna Park', email: 'anna@example.com', phone: PHONE });
const ben = contactSchema.parse({ name: 'Ben Park', email: 'ben@example.com', phone: PHONE });

beforeEach(async () => {
  await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade');
  outbox.length = 0;
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('Pottery Wheel', 'Barn', 60) returning id`);
  slotId = (await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, '2026-11-14 15:00:00+00', 20) returning id`, [a.rows[0].id])).rows[0].id;
});
afterAll(() => pool.end());

const book = async (contact: typeof anna, n = 1) => {
  const h = await holdSpots(slotId, n);
  return confirmBooking(h.holdId, { contact, remindSms: true, remindEmail: true });
};
const people = async () => (await pool.query<{ name: string; email: string | null; phone: string }>('select name, email, phone from people order by created_at')).rows;

describe('people sharing a phone number', () => {
  it('keeps two people with different emails separate, names intact', async () => {
    const a = await book(anna);
    const b = await book(ben, 2);
    expect(a.personId).not.toBe(b.personId);
    expect(await people()).toEqual([
      { name: 'Anna Park', email: 'anna@example.com', phone: E164 },
      { name: 'Ben Park', email: 'ben@example.com', phone: E164 },
    ]);
    expect((await getBooking(a.bookingId))?.personName).toBe('Anna Park');
  });

  it('still recognises the same person by email, even on a new phone', async () => {
    const a1 = await book(anna);
    await cancelBooking(a1.bookingId, a1.personId); // one person can't have two overlapping sign-ups
    const a2 = await book(contactSchema.parse({ name: 'Anna P.', email: 'ANNA@example.com', phone: '412 555 0199' }));
    expect(a2.personId).toBe(a1.personId);
    expect(await people()).toEqual([{ name: 'Anna P.', email: 'anna@example.com', phone: '+14125550199' }]);
  });

  it('walk-ins without email match on phone + name, otherwise become a new person', async () => {
    // (Each earlier sign-up is cancelled first: one person can't hold two at the same time.)
    const a = await book(anna);
    await cancelBooking(a.bookingId, a.personId);
    const sameAnna = await walkInBooking(slotId, 1, walkInContactSchema.parse({ name: 'anna park', phone: PHONE, email: '' }));
    const grandma = await walkInBooking(slotId, 1, walkInContactSchema.parse({ name: 'Rose Park', phone: PHONE, email: '' }));
    await cancelBooking(grandma.bookingId, grandma.personId);
    const grandmaAgain = await walkInBooking(slotId, 1, walkInContactSchema.parse({ name: 'Rose Park', phone: PHONE, email: '' }));
    const all = await people();
    expect(all.map((p) => p.name)).toEqual(['Anna Park', 'Rose Park']);
    expect(grandmaAgain.personId).toBe(grandma.personId);
    expect(sameAnna.personId).not.toBe(grandma.personId);
  });

  it('adds an email to a walk-in record when that person later signs up online', async () => {
    const w = await walkInBooking(slotId, 1, walkInContactSchema.parse({ name: 'Rose Park', phone: PHONE, email: '' }));
    await cancelBooking(w.bookingId, w.personId); // one person can't have two overlapping sign-ups
    const online = await book(contactSchema.parse({ name: 'Rose Park', email: 'rose@example.com', phone: PHONE }));
    expect(online.personId).toBe(w.personId);
    expect(await people()).toEqual([{ name: 'Rose Park', email: 'rose@example.com', phone: E164 }]);
  });

  it('signing in with the shared phone covers everyone on it; email covers one person', async () => {
    const a = await book(anna);
    const b = await book(ben);
    const r = await startLogin(PHONE);
    // Texting not set up: the code goes to every email on that number.
    expect(r.via).toBe('email');
    expect(outbox.map((m) => m.to).sort()).toEqual(['anna@example.com', 'ben@example.com']);
    const code = outbox.at(-1)!.text.match(/\b(\d{6})\b/)![1];
    const v = await verifyLogin(r.ticket!, code);
    expect(v).toEqual({ viewer: { kind: 'phone', phone: E164 } });
    expect((await viewerPersonIds((v as { viewer: never }).viewer)).sort()).toEqual([a.personId, b.personId].sort());

    outbox.length = 0;
    const r2 = await startLogin('ben@example.com');
    expect(outbox.map((m) => m.to)).toEqual(['ben@example.com']);
    const v2 = await verifyLogin(r2.ticket!, outbox[0].text.match(/\b(\d{6})\b/)![1]);
    expect(await viewerPersonIds((v2 as { viewer: never }).viewer)).toEqual([b.personId]);
  });

  it('lets someone on the shared phone cancel a family member’s booking, but not a stranger', async () => {
    const a = await book(anna);
    const b = await book(ben);
    const stranger = await book(contactSchema.parse({ name: 'Sam Lee', email: 'sam@example.com', phone: '412 555 0177' }));
    const family = await viewerPersonIds({ kind: 'phone', phone: E164 });
    await cancelBooking(b.bookingId, family);
    await expect(cancelBooking(stranger.bookingId, family)).rejects.toMatchObject({ code: 'booking_not_found' });
    expect((await getBooking(a.bookingId))?.status).toBe('confirmed');
    expect((await getBooking(b.bookingId))?.status).toBe('cancelled');
  });

  it('starts each reminder text with the person’s first name', async () => {
    const b = await book(ben);
    process.env.TWILIO_ACCOUNT_SID = 'x'; process.env.TWILIO_AUTH_TOKEN = 'x'; process.env.TWILIO_FROM = '+15550000000';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"sid":"SM1"}', { status: 201 }));
    try {
      await sendReminder((await getBooking(b.bookingId))!);
      const body = new URLSearchParams(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
      expect(body.get('To')).toBe(E164);
      expect(body.get('Body')).toMatch(/^Mindfulness Weekend: Ben, Pottery Wheel starts in 15 min/);
    } finally {
      fetchSpy.mockRestore();
      delete process.env.TWILIO_ACCOUNT_SID; delete process.env.TWILIO_AUTH_TOKEN; delete process.env.TWILIO_FROM;
    }
  });

  it('signed session cookies round-trip and old person cookies still work', () => {
    expect(decodeViewer(encodeSession({ kind: 'phone', phone: E164 }))).toEqual({ kind: 'phone', phone: E164 });
    const id = '0b3c4d5e-1111-4222-8333-944455556666';
    expect(decodeViewer(encodeSession(id))).toEqual({ kind: 'person', personId: id });
    expect(decodeViewer(encodeSession({ kind: 'phone', phone: E164 }).replace('0100', '0101'))).toBeNull();
  });
});
