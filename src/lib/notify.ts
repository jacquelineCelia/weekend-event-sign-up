import { bookingText, type BookingView } from './queries';
import { addMinutes, dayOf, dayText, fmtTimeL, isChinese, type Lang } from './event';
import { eventName as eventNameFor } from './hans';
import { localText, seatLine } from './hans';
import { dict, firstName } from './i18n';
import { SmsOptedOut, sendEmail, sendSms, smsEnabled } from './messaging';
import { getPool } from './db';

/**
 * Texts go only to people who ticked "By text message" (or, for walk-ins, said yes to staff).
 * That choice is stored per booking as remind_sms. A number counts as opted in when any booking
 * made with it has remind_sms on.
 */
export async function phoneOptedIn(phone: string) {
  const r = await getPool().query<{ ok: boolean }>(
    `select exists(select 1 from bookings b join people p on p.id = b.person_id where p.phone = $1 and b.remind_sms) as ok`,
    [phone],
  );
  return r.rows[0].ok;
}

/** Someone replied STOP: stop texting that number and send their reminders by email instead. */
export async function markOptedOut(phone: string) {
  await getPool().query(
    `update bookings set remind_sms = false, remind_email = (remind_email or p.email is not null)
       from people p where p.id = bookings.person_id and p.phone = $1 and bookings.remind_sms`,
    [phone],
  );
}

/** Sends a text; returns false (and records the opt-out) if the number has replied STOP. */
async function trySms(phone: string, text: string) {
  try {
    await sendSms(phone, text);
    return true;
  } catch (e) {
    if (e instanceof SmsOptedOut) { await markOptedOut(phone); return false; }
    throw e;
  }
}

// APP_URL wins (set it for production). On Vercel previews, fall back to the branch's own URL so
// links in test emails open the preview, not localhost.
const vercelHost = () => process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
const appUrl = () =>
  (process.env.APP_URL || (vercelHost() ? `https://${vercelHost()}` : 'http://localhost:3000')).replace(/\/$/, '');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const eventName = eventNameFor;

function emailHtml(lang: Lang, title: string, lines: string[], code: string | null, cta?: { href: string; label: string }) {
  const font =
    lang === 'zh' ? "'PingFang TC','Noto Sans TC','Microsoft JhengHei',Helvetica,Arial,sans-serif"
    : lang === 'zhs' ? "'PingFang SC','Noto Sans SC','Microsoft YaHei',Helvetica,Arial,sans-serif"
    : 'Helvetica,Arial,sans-serif';
  return `<!doctype html><html lang="${dict(lang).htmlLang}"><body style="margin:0;background:#eeefe7;font-family:${font};color:#22302a">
<div style="max-width:480px;margin:0 auto;padding:24px 16px">
<div style="background:#2a3d31;color:#fbfbf7;border-radius:20px;padding:20px">
<div style="font-size:13px;color:#d5decf">${esc(eventName(lang))}</div>
<div style="font-family:Georgia,serif;font-size:22px;margin-top:6px">${esc(title)}</div>
${code ? `<div style="display:inline-block;margin-top:12px;background:#fbfbf7;color:#22302a;border-radius:999px;padding:4px 12px;font-weight:700;letter-spacing:.14em">${esc(code)}</div>` : ''}
</div>
<div style="background:#fbfbf7;border-radius:20px;padding:18px 20px;margin-top:12px;font-size:15px;line-height:${isChinese(lang) ? 1.75 : 1.55}">
${lines.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join('')}
${cta ? `<a href="${esc(cta.href)}" style="display:inline-block;margin-top:6px;background:#3d6a4f;color:#fbfbf7;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:600">${esc(cta.label)}</a>` : ''}
</div></div></body></html>`;
}

/** Sent right after booking, in the attendee's language: by email when we have one, and by text when they opted in to texts. */
export async function sendConfirmation(b: BookingView) {
  const lang = b.personLang;
  const m = dict(lang).msg;
  const { activity, place } = bookingText(b, lang);
  const day = dayOf(b.startsAt);
  const dayLong = day ? dayText(day, 'long', lang) : '';
  const daySh = day ? dayText(day, 'short', lang) : '';
  const time = fmtTimeL(b.startsAt, lang);
  const when = isChinese(lang) ? `${dayLong}${time}` : `${dayLong}, ${time}`;
  const reminder = b.remindSms || b.remindEmail ? m.willRemind(fmtTimeL(addMinutes(b.startsAt, -15), lang)) : '';
  const seating = b.seats.length ? m.seatingLine(seatLine(b.seats, lang)) : '';
  const lines = [m.whenWhere(activity, when, place), m.partyFor(b.partySize, b.personName ?? '', b.code ?? ''), seating, reminder, m.plansChanged].filter(Boolean);
  const url = `${appUrl()}/me`;
  if (b.personEmail) {
    await sendEmail(
      b.personEmail,
      m.youreInSubject(activity, daySh, time),
      lines.join('\n\n') + `\n\n${dict(lang).mySignups}: ${url}`,
      emailHtml(lang, m.youreInTitle(activity), lines, b.code, { href: url, label: dict(lang).mySignups }),
    );
  }
  // The first text anyone gets names the event and says how to stop (carrier rules).
  if (b.remindSms && b.personPhone && smsEnabled()) {
    await trySms(b.personPhone, m.confirmSms(eventName(lang), firstName(b.personName), activity, when, place, b.partySize, b.code ?? '', reminder));
  }
}

/** The 15-minute reminder, in the attendee's language. Text if chosen and available; email if chosen, or as the fallback. */
export async function sendReminder(b: BookingView) {
  const lang = b.personLang;
  const m = dict(lang).msg;
  const { activity, place } = bookingText(b, lang);
  const start = fmtTimeL(b.startsAt, lang);
  const url = `${appUrl()}/me`;
  const sent: string[] = [];
  let textSent = false;
  if (b.remindSms && b.personPhone && smsEnabled()) {
    textSent = await trySms(b.personPhone, m.reminderSms(eventName(lang), firstName(b.personName), activity, start, place, b.partySize, b.code ?? '', url));
    if (textSent) sent.push('sms');
  }
  const emailFallback = b.remindSms && !textSent;
  if (b.personEmail && (b.remindEmail || emailFallback)) {
    const lines = m.reminderLines(activity, start, place, b.partySize);
    if (b.seats.length) lines.splice(2, 0, m.seatingLine(seatLine(b.seats, lang)));
    await sendEmail(
      b.personEmail,
      m.reminderSubject(activity, start),
      lines.join('\n\n') + `\n\n${url}`,
      emailHtml(lang, m.reminderTitle(activity), lines, b.code, { href: url, label: m.cantMakeIt }),
    );
    sent.push('email');
  }
  return sent;
}

export async function sendLoginCode(to: { email: string | null; phone: string | null }, code: string, via: 'email' | 'sms', lang: Lang = 'en') {
  const m = dict(lang).msg;
  const text = m.loginText(code, eventName(lang));
  if (via === 'sms' && to.phone) return sendSms(to.phone, text);
  if (to.email) return sendEmail(to.email, m.loginSubject(code), text, emailHtml(lang, m.loginTitle, [text], code));
}

/** Staff moved a booked time slot: tell the guest, in their language. */
export async function sendTimeChange(
  p: { email: string | null; phone: string | null; code: string; lang: Lang; sms: boolean },
  act: { name: string; nameZh: string },
  from: Date,
  to: Date,
) {
  const m = dict(p.lang).msg;
  const activity = localText(act.name, act.nameZh, p.lang);
  const text = m.timeChange(eventName(p.lang), activity, fmtTimeL(to, p.lang), fmtTimeL(from, p.lang), p.code);
  if (p.sms && p.phone && smsEnabled() && (await trySms(p.phone, text))) return;
  if (p.email) return sendEmail(p.email, m.timeChangeSubject(activity, fmtTimeL(to, p.lang)), text);
}
