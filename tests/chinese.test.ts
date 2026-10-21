import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { confirmBooking, holdSpots, walkInBooking } from '@/lib/booking';
import { contactSchema, walkInContactSchema } from '@/lib/contact';
import { startLogin } from '@/lib/login';
import { outbox } from '@/lib/messaging';
import { activitiesForDay, getBooking } from '@/lib/queries';
import { sendConfirmation, sendReminder } from '@/lib/notify';
import { saveSchedule, scheduleFor } from '@/lib/staff';
import { EVENT, fmtTimeL, fmtDurationL, dayText } from '@/lib/event';
import { dict, errorText, firstName, langFromAcceptLanguage } from '@/lib/i18n';
import { eventName, toSimplified } from '@/lib/hans';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();
let slotId: string;
let actId: string;
const DAY = '2026-11-14';

beforeEach(async () => {
  await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade');
  outbox.length = 0;
  actId = (await pool.query<{ id: string }>(
    `insert into activities (name, place, duration_min, name_zh, place_zh) values ('Pottery Wheel', 'Barn Studio', 60, '拉坯體驗', '穀倉工作室') returning id`,
  )).rows[0].id;
  // 11:30 AM New York
  slotId = (await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, '2026-11-14 16:30:00+00', 10) returning id`, [actId])).rows[0].id;
});
afterAll(() => pool.end());

const mei = contactSchema.parse({ name: '王美玲', email: 'mei@example.com', phone: '412 555 0123' });
const book = async (lang: 'en' | 'zh' | 'zhs') => {
  const h = await holdSpots(slotId, 2);
  return confirmBooking(h.holdId, { contact: mei, remindSms: false, remindEmail: true, lang });
};

describe('language helpers', () => {
  it('detects Traditional and Simplified Chinese browsers', () => {
    expect(langFromAcceptLanguage('zh-TW,zh;q=0.9,en;q=0.8')).toBe('zh');
    expect(langFromAcceptLanguage('zh-Hant-HK')).toBe('zh');
    expect(langFromAcceptLanguage('zh')).toBe('zhs');
    expect(langFromAcceptLanguage('zh-CN,zh;q=0.9')).toBe('zhs');
    expect(langFromAcceptLanguage('zh-Hans-SG')).toBe('zhs');
    expect(langFromAcceptLanguage('en-US,en;q=0.9,zh-TW;q=0.5')).toBe('en');
    expect(langFromAcceptLanguage(null)).toBe('en');
  });

  it('formats times, days and durations the Taiwan way', () => {
    const at = (iso: string) => new Date(iso);
    expect(fmtTimeL(at('2026-11-14T16:30:00Z'), 'zh')).toBe('上午 11:30');
    expect(fmtTimeL(at('2026-11-14T17:00:00Z'), 'zh')).toBe('中午 12:00');
    expect(fmtTimeL(at('2026-11-14T19:30:00Z'), 'zh')).toBe('下午 2:30');
    expect(fmtTimeL(at('2026-11-15T01:00:00Z'), 'zh')).toBe('晚上 8:00');
    expect(fmtTimeL(at('2026-11-14T16:30:00Z'), 'en')).toBe('11:30 AM');
    expect(dayText(EVENT.days[0], 'long', 'zh')).toBe('11月14日（星期六）');
    expect(fmtDurationL(90, 'zh')).toBe('1 小時 30 分鐘');
    expect(firstName('王美玲')).toBe('王美玲');
    expect(firstName('Ben Park')).toBe('Ben');
  });

  it('has every English text in Chinese too, with no English left behind', () => {
    const en = dict('en'), zh = dict('zh');
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(zh.errors).sort()).toEqual(Object.keys(en.errors).sort());
    for (const v of Object.values(zh.errors)) expect(v).toMatch(/[一-鿿]/);
    expect(errorText('zh', { code: 'not_enough_spots', remaining: 2 })).toBe('這個時段只剩 2 位。');
    expect(errorText('zh', 'name_required')).toBe('請輸入姓名');
  });
});

describe('Chinese activity text', () => {
  it('shows Chinese names when filled in, English when blank', async () => {
    await pool.query(`insert into activities (name, place, duration_min) values ('Archery', 'Range B', 45)`);
    const a2 = (await pool.query<{ id: string }>(`select id from activities where name = 'Archery'`)).rows[0].id;
    await pool.query(`insert into slots (activity_id, starts_at, capacity) values ($1, '2026-11-14 15:00:00+00', 6)`, [a2]);
    const zh = await activitiesForDay(DAY, 'zh');
    expect(zh.map((a) => [a.name, a.place]).sort()).toEqual([['Archery', 'Range B'], ['拉坯體驗', '穀倉工作室']].sort());
    const en = await activitiesForDay(DAY, 'en');
    expect(en.map((a) => a.name).sort()).toEqual(['Archery', 'Pottery Wheel']);
  });
});

describe('messages in the attendee’s saved language', () => {
  it('saves the language at sign-up and sends the confirmation and reminder in Chinese', async () => {
    const r = await book('zh');
    const b = (await getBooking(r.bookingId))!;
    expect(b.personLang).toBe('zh');
    await sendConfirmation(b);
    await sendReminder(b);
    const [confirm, remind] = outbox;
    expect(confirm.subject).toBe('報名成功：拉坯體驗，11/14（六） 上午 11:30');
    expect(confirm.text).toContain('王美玲，共 2 位。報到時請出示代碼');
    expect(confirm.text).toContain('我們會在上午 11:15 提醒你。');
    expect(remind.subject).toBe('15 分鐘後開始：拉坯體驗，上午 11:30');
    expect(remind.text).toContain('拉坯體驗將於上午 11:30 在穀倉工作室開始。');
  });

  it('keeps reminder texts short in Chinese (two text-message parts at most)', async () => {
    const r = await book('zh');
    process.env.TWILIO_ACCOUNT_SID = 'x'; process.env.TWILIO_AUTH_TOKEN = 'x'; process.env.TWILIO_FROM = '+15550000000';
    await pool.query('update bookings set remind_sms = true where id = $1', [r.bookingId]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"sid":"SM1"}', { status: 201 }));
    try {
      await sendReminder((await getBooking(r.bookingId))!);
      const body = new URLSearchParams(String((fetchSpy.mock.calls[0][1] as RequestInit).body)).get('Body')!;
      expect(body).toMatch(/^正念週末：王美玲，拉坯體驗 15 分鐘後開始（上午 11:30，穀倉工作室）。2位，代碼 /);
      expect(body.length).toBeLessThanOrEqual(134); // 2 × 67-character parts for Chinese text
    } finally {
      fetchSpy.mockRestore();
      delete process.env.TWILIO_ACCOUNT_SID; delete process.env.TWILIO_AUTH_TOKEN; delete process.env.TWILIO_FROM;
    }
  });

  it('switches language when the same person later signs up in English', async () => {
    const first = await book('zh');
    // The same person can't hold two sign-ups at once, so the first is cancelled.
    await pool.query(`update bookings set status = 'cancelled' where id = $1`, [first.bookingId]);
    const r = await book('en');
    expect((await getBooking(r.bookingId))!.personLang).toBe('en');
  });

  it('sends the sign-in code in the language of the screen', async () => {
    await book('zh');
    outbox.length = 0;
    await startLogin('mei@example.com', 'zh');
    expect(outbox[0].subject).toMatch(/^你的登入代碼：\d{6}$/);
    expect(outbox[0].text).toMatch(/^正念週末：\d{6} 是你的登入代碼，10 分鐘內有效。$/);
  });

  it('walk-ins get messages in the language staff picked', async () => {
    const r = await walkInBooking(slotId, 1, walkInContactSchema.parse({ name: 'Lin', phone: '412 555 0144', email: 'lin@example.com' }), { lang: 'zh' });
    expect((await getBooking(r.bookingId))!.personLang).toBe('zh');
  });

  it('tells a Chinese-speaking guest about a time change in Chinese', async () => {
    await book('zh');
    outbox.length = 0;
    const [s] = await scheduleFor(actId, DAY);
    expect(await saveSchedule(actId, DAY, [{ id: s.id, time: '13:00', capacity: 10 }])).toEqual({ notified: 1 });
    expect(outbox[0].text).toBe(`正念週末：時段異動。拉坯體驗改為下午 1:00 開始（原為上午 11:30）。名額與代碼 ${outbox[0].text.match(/代碼 (\w{4})/)![1]} 不變。`);
  });
});

describe('Simplified Chinese', () => {
  const flat = (o: unknown): string[] =>
    typeof o === 'string' ? [o]
    : typeof o === 'function' ? flat((() => {
        try { return (o as (...a: unknown[]) => unknown)(1, 2, '上午 11:30', 'X', 'Y', 3, 'CODE', ''); }
        catch { return (o as (...a: unknown[]) => unknown)(['上午 11:30', '下午 1:00']); }
      })())
    : Array.isArray(o) ? o.flatMap(flat)
    : o && typeof o === 'object' ? Object.values(o).flatMap(flat) : [];

  it('has every text, all already in Simplified characters and mainland wording', () => {
    const zhs = dict('zhs');
    expect(Object.keys(zhs).sort()).toEqual(Object.keys(dict('en')).sort());
    const all = flat(zhs).join('\n');
    expect(toSimplified(all)).toBe(all); // nothing left in Traditional
    for (const taiwanWord of ['代碼', '额满', '进程', '行事历', '信箱', '报到', '「']) expect(all).not.toContain(taiwanWord);
    expect(zhs.msg.loginSubject('123456')).toBe('你的登录验证码：123456');
    expect(zhs.checkInCode).toBe('签到码');
  });

  it('derives the Simplified event name from the Traditional one unless set', () => {
    const saved = process.env.NEXT_PUBLIC_EVENT_NAME_ZHS;
    try {
      delete process.env.NEXT_PUBLIC_EVENT_NAME_ZHS;
      expect(eventName('zhs')).toBe(toSimplified(EVENT.nameZh));
      process.env.NEXT_PUBLIC_EVENT_NAME_ZHS = '我的周末';
      expect(eventName('zhs')).toBe('我的周末');
    } finally {
      if (saved === undefined) delete process.env.NEXT_PUBLIC_EVENT_NAME_ZHS; else process.env.NEXT_PUBLIC_EVENT_NAME_ZHS = saved;
    }
  });

  it('converts the Traditional activity text staff typed', async () => {
    const zhs = await activitiesForDay(DAY, 'zhs');
    expect(zhs.map((a) => [a.name, a.place])).toEqual([['拉坯体验', '谷仓工作室']]);
    expect(fmtDurationL(90, 'zhs')).toBe('1 小时 30 分钟');
  });

  it('sends messages in Simplified to people who signed up in it', async () => {
    const r = await book('zhs');
    const b = (await getBooking(r.bookingId))!;
    expect(b.personLang).toBe('zhs');
    await sendConfirmation(b);
    expect(outbox[0].subject).toBe('报名成功：拉坯体验，11/14（六） 上午 11:30');
    expect(outbox[0].text).toContain('签到时请出示签到码');
    expect(outbox[0].text).toContain('地点：谷仓工作室');
  });
});
