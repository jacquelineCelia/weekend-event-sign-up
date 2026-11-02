import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { cancelBooking, confirmBooking, holdSpots, walkInBooking } from '@/lib/booking';
import { contactSchema, walkInContactSchema } from '@/lib/contact';
import { startLogin, verifyLogin } from '@/lib/login';
import { outbox } from '@/lib/messaging';
import { decodeViewer, encodeSession } from '@/lib/session';
import { viewerPersonIds } from '@/lib/viewer';
import { getBooking } from '@/lib/queries';
import { sendReminder, sendTimeChange } from '@/lib/notify';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();
let yoga: string;
let tea: string;
const MAIL = 'parks@example.com';

const contact = (name: string, phone = '412 555 0100', email = MAIL) => contactSchema.parse({ name, email, phone });
const anna = contact('Anna Park');
const ben = contact('Ben Park', '412 555 0101');

beforeEach(async () => {
  await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade');
  outbox.length = 0;
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('Yoga', 'Hall', 50), ('Tea', 'Room', 50) returning id`);
  const at = `insert into slots (activity_id, starts_at, capacity) values ($1, '2026-11-14 19:50:00+00', 20) returning id`;
  yoga = (await pool.query<{ id: string }>(at, [a.rows[0].id])).rows[0].id;
  tea = (await pool.query<{ id: string }>(at, [a.rows[1].id])).rows[0].id;
});
afterAll(() => pool.end());

const book = async (slot: string, c: typeof anna) => confirmBooking((await holdSpots(slot, 1)).holdId, { contact: c, remindSms: false, remindEmail: true });

describe('people sharing an email', () => {
  it('keeps two people on one email separate, with their own names and phones', async () => {
    const a = await book(yoga, anna);
    const b = await book(tea, ben);
    expect(a.personId).not.toBe(b.personId);
    const rows = (await pool.query('select name, email, phone from people order by created_at')).rows;
    expect(rows).toEqual([
      { name: 'Anna Park', email: MAIL, phone: '+14125550100' },
      { name: 'Ben Park', email: MAIL, phone: '+14125550101' },
    ]);
    expect((await getBooking(a.bookingId))?.personName).toBe('Anna Park');
  });

  it('lets them do different things at the same time, and still stops one person doing two', async () => {
    await book(yoga, anna);
    await expect(book(tea, ben)).resolves.toBeTruthy();
    await expect(book(tea, contact('anna  PARK'))).rejects.toMatchObject({ code: 'overlap' });
  });

  it('sees through case and spacing in names, including Chinese names', async () => {
    const a = await book(yoga, contact('王小明'));
    await cancelBooking(a.bookingId, a.personId);
    expect((await book(yoga, contact('王　小明'))).personId).toBe(a.personId);
  });

  it('applies to walk-ins with an email too', async () => {
    const a = await book(yoga, anna);
    const w = await walkInBooking(tea, 1, walkInContactSchema.parse({ name: 'Ben Park', email: MAIL, phone: '412 555 0101' }));
    expect(w.personId).not.toBe(a.personId);
    await expect(walkInBooking(tea, 1, walkInContactSchema.parse({ name: 'Anna Park', email: MAIL, phone: '412 555 0100' })))
      .rejects.toMatchObject({ code: 'overlap' });
  });

  it('two people signing up at the same moment each get a record', async () => {
    const results = await Promise.all([book(yoga, anna), book(tea, ben)]);
    expect(new Set(results.map((r) => r.personId)).size).toBe(2);
  });

  it('signing in with the shared email covers everyone on it, with one code and one email', async () => {
    const a = await book(yoga, anna);
    const b = await book(tea, ben);
    const stranger = await book(tea, contact('Sam Lee', '412 555 0177', 'sam@example.com'));
    outbox.length = 0;
    const r = await startLogin(MAIL.toUpperCase());
    expect(outbox.map((m) => m.to)).toEqual([MAIL]);
    const v = await verifyLogin(r.ticket!, outbox[0].text.match(/\b(\d{6})\b/)![1]);
    expect(v).toEqual({ viewer: { kind: 'email', email: MAIL } });
    const ids = await viewerPersonIds((v as { viewer: never }).viewer);
    expect(ids.sort()).toEqual([a.personId, b.personId].sort());
    await cancelBooking(b.bookingId, ids);
    await expect(cancelBooking(stranger.bookingId, ids)).rejects.toMatchObject({ code: 'booking_not_found' });
  });

  it('limits sign-in codes per email, not per person', async () => {
    await book(yoga, anna);
    await book(tea, ben);
    for (let i = 0; i < 3; i++) expect((await startLogin(MAIL)).ticket).toBeTruthy();
    expect((await startLogin(MAIL)).limited).toBe(true);
  });

  it('sessions for an email or several people round-trip and are signed', async () => {
    const ids = ['0b3c4d5e-1111-4222-8333-944455556666', '1b3c4d5e-1111-4222-8333-944455556666'];
    expect(decodeViewer(encodeSession({ kind: 'email', email: 'a.b@example.com' }))).toEqual({ kind: 'email', email: 'a.b@example.com' });
    expect(decodeViewer(encodeSession({ kind: 'people', personIds: ids }))).toEqual({ kind: 'people', personIds: ids });
    expect(decodeViewer(encodeSession({ kind: 'email', email: 'a@example.com' }).replace('a@', 'b@'))).toBeNull();
  });

  it('a "people" session only covers the people listed', async () => {
    const a = await book(yoga, anna);
    await book(tea, ben);
    expect(await viewerPersonIds({ kind: 'people', personIds: [a.personId] })).toEqual([a.personId]);
  });

  it('says who a reminder or time-change email is for', async () => {
    const b = await book(tea, ben);
    outbox.length = 0;
    await sendReminder((await getBooking(b.bookingId))!);
    expect(outbox[0].text).toMatch(/^For Ben Park/);
    outbox.length = 0;
    await sendTimeChange({ name: 'Ben Park', email: MAIL, phone: null, code: 'AB23', lang: 'en', sms: false }, { name: 'Tea', nameZh: '' }, new Date(), new Date());
    expect(outbox[0].text).toMatch(/^For Ben Park/);
  });
});
