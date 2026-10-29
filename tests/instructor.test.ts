import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { confirmBooking, holdSpots } from '@/lib/booking';
import { contactSchema } from '@/lib/contact';
import { outbox } from '@/lib/messaging';
import { activitiesForDay, bookingText, getBooking } from '@/lib/queries';
import { sendConfirmation, sendReminder } from '@/lib/notify';
import { activitiesWithCounts, registrationAt, saveActivity, sessionsForDay } from '@/lib/staff';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();
const DAY = '2026-11-14';
let actId: string;
let slotIds: string[];

const base = { name: 'Savor the Now', place: 'Conference 1-2', durationMin: 50, description: '', nameZh: '覺察・靜心茶席', placeZh: '', descriptionZh: '' };

beforeEach(async () => {
  await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade');
  outbox.length = 0;
  actId = await saveActivity(null, { ...base, instructor: 'Teacher Zhenru', instructorZh: '真如老師' });
  slotIds = [];
  for (const t of ['2026-11-14 19:50:00+00', '2026-11-14 21:00:00+00']) {
    slotIds.push((await pool.query<{ id: string }>('insert into slots (activity_id, starts_at, capacity) values ($1, $2, 30) returning id', [actId, t])).rows[0].id);
  }
});
afterAll(() => pool.end());

const book = async (slotId: string, lang: 'en' | 'zh' | 'zhs', sms = false) => {
  const h = await holdSpots(slotId, 2);
  const contact = contactSchema.parse({ name: 'Mei Wang', email: 'mei@example.com', phone: '412 555 0123' });
  return confirmBooking(h.holdId, { contact, remindSms: sms, remindEmail: true, lang });
};

describe('instructor', () => {
  it('is one name per activity, shown the same at every time, in each language', async () => {
    const [en] = await activitiesForDay(DAY, 'en');
    const [zh] = await activitiesForDay(DAY, 'zh');
    const [zhs] = await activitiesForDay(DAY, 'zhs');
    expect(en.slots).toHaveLength(2);
    expect(en.instructor).toBe('Teacher Zhenru');
    expect(zh.instructor).toBe('真如老師');
    expect(zhs.instructor).toBe('真如老师');
    for (const id of slotIds) {
      const b = (await getBooking((await book(id, 'en')).bookingId))!;
      expect(bookingText(b, 'en').instructor).toBe('Teacher Zhenru');
      expect(bookingText(b, 'zh').instructor).toBe('真如老師');
      await pool.query('truncate bookings, people cascade');
    }
  });

  it('falls back to English when there is no Chinese, and is blank when not set', async () => {
    await saveActivity(actId, { ...base, instructor: 'Teacher Zhenru', instructorZh: '' });
    expect((await activitiesForDay(DAY, 'zh'))[0].instructor).toBe('Teacher Zhenru');
    await saveActivity(actId, { ...base, instructor: '', instructorZh: '' });
    expect((await activitiesForDay(DAY, 'en'))[0].instructor).toBe('');
  });

  it('reaches the staff screens', async () => {
    expect((await activitiesWithCounts(DAY))[0]).toMatchObject({ instructor: 'Teacher Zhenru', instructor_zh: '真如老師' });
    expect((await sessionsForDay(DAY)).every((s) => s.instructor === 'Teacher Zhenru')).toBe(true);
    const [r] = await registrationAt(new Date('2026-11-14T19:50:00Z'));
    expect(r).toMatchObject({ instructor: 'Teacher Zhenru', instructorZh: '真如老師' });
  });

  it('is in the confirmation and reminder emails, but not in texts (campaign wording)', async () => {
    const r = await book(slotIds[0], 'zh', true);
    process.env.TWILIO_ACCOUNT_SID = 'x'; process.env.TWILIO_AUTH_TOKEN = 'x'; process.env.TWILIO_FROM = '+15550000000';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"sid":"SM1"}', { status: 201 }));
    try {
      const b = (await getBooking(r.bookingId))!;
      await sendConfirmation(b);
      await pool.query('update bookings set remind_sms = false where id = $1', [r.bookingId]);
      await sendReminder((await getBooking(r.bookingId))!);
      const emails = outbox.filter((m) => m.channel === 'email');
      expect(emails).toHaveLength(2);
      for (const e of emails) expect(e.text).toContain('引導：真如老師。');
      const sms = fetchSpy.mock.calls.map((c) => new URLSearchParams(String((c[1] as RequestInit).body)).get('Body')!);
      expect(sms).toHaveLength(1);
      expect(sms[0]).not.toContain('真如');
    } finally {
      fetchSpy.mockRestore();
      delete process.env.TWILIO_ACCOUNT_SID; delete process.env.TWILIO_AUTH_TOKEN; delete process.env.TWILIO_FROM;
    }
  });
});
