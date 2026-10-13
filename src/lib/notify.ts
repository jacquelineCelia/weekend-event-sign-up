import type { BookingView } from './queries';
import { EVENT, addMinutes, dayOf, fmtTime } from './event';
import { sendEmail, sendSms, smsEnabled } from './messaging';

const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const spots = (n: number) => `${n} ${n === 1 ? 'spot' : 'spots'}`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function emailHtml(title: string, lines: string[], code: string | null, cta?: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#eeefe7;font-family:Helvetica,Arial,sans-serif;color:#22302a">
<div style="max-width:480px;margin:0 auto;padding:24px 16px">
<div style="background:#2a3d31;color:#fbfbf7;border-radius:20px;padding:20px">
<div style="font-size:13px;color:#d5decf">${esc(EVENT.name)}</div>
<div style="font-family:Georgia,serif;font-size:22px;margin-top:6px">${esc(title)}</div>
${code ? `<div style="display:inline-block;margin-top:12px;background:#fbfbf7;color:#22302a;border-radius:999px;padding:4px 12px;font-weight:700;letter-spacing:.14em">${esc(code)}</div>` : ''}
</div>
<div style="background:#fbfbf7;border-radius:20px;padding:18px 20px;margin-top:12px;font-size:15px;line-height:1.55">
${lines.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join('')}
${cta ? `<a href="${esc(cta.href)}" style="display:inline-block;margin-top:6px;background:#3d6a4f;color:#fbfbf7;text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:600">${esc(cta.label)}</a>` : ''}
</div></div></body></html>`;
}

/** Sent right after booking: email when we have one, otherwise a text. */
export async function sendConfirmation(b: BookingView) {
  const day = dayOf(b.startsAt);
  const when = `${day?.long ?? ''}, ${fmtTime(b.startsAt)}`;
  const reminder = b.remindSms || b.remindEmail ? `We'll remind you at ${fmtTime(addMinutes(b.startsAt, -15))}.` : '';
  const lines = [
    `${b.activityName} — ${when} at ${b.place}.`,
    `${spots(b.partySize)} for ${b.personName}. Show your code ${b.code}, your name or your phone number at the door.`,
    reminder,
    'Plans changed? Cancel from My sign-ups so someone else can take your spots.',
  ].filter(Boolean);
  if (b.personEmail) {
    await sendEmail(
      b.personEmail,
      `You're in: ${b.activityName}, ${day?.short ?? ''} ${fmtTime(b.startsAt)}`,
      lines.join('\n\n') + `\n\nMy sign-ups: ${appUrl()}/me`,
      emailHtml(`You're in: ${b.activityName}`, lines, b.code, { href: `${appUrl()}/me`, label: 'My sign-ups' }),
    );
  } else if (b.personPhone && smsEnabled()) {
    await sendSms(b.personPhone, `${EVENT.name}: you're in for ${b.activityName}, ${when}, ${b.place}. ${spots(b.partySize)}, code ${b.code}. ${reminder}`);
  }
}

/** The 15-minute reminder. Text if chosen and available; email if chosen, or as the fallback. */
export async function sendReminder(b: BookingView) {
  const start = fmtTime(b.startsAt);
  const cancel = `${appUrl()}/me`;
  const sent: string[] = [];
  const wantSms = b.remindSms && !!b.personPhone && smsEnabled();
  if (wantSms) {
    await sendSms(
      b.personPhone!,
      `Starting in 15 min: ${b.activityName} at ${start}, ${b.place}. ${spots(b.partySize)} for ${b.personName?.split(' ')[0]}, code ${b.code}.\n\nCan't make it? Let us know so someone else can take your spots: ${cancel}`,
    );
    sent.push('sms');
  }
  const emailFallback = b.remindSms && !wantSms;
  if (b.personEmail && (b.remindEmail || emailFallback)) {
    const lines = [
      `${b.activityName} starts at ${start} at ${b.place}.`,
      `${spots(b.partySize)} · show this code, your name or your phone number at the door.`,
      "Can't make it? Cancel so someone else can enjoy your spots.",
    ];
    await sendEmail(
      b.personEmail,
      `In 15 minutes: ${b.activityName}, ${start}`,
      lines.join('\n\n') + `\n\n${cancel}`,
      emailHtml(`In 15 minutes: ${b.activityName}`, lines, b.code, { href: cancel, label: "I can't make it" }),
    );
    sent.push('email');
  }
  return sent;
}

export async function sendLoginCode(to: { email: string | null; phone: string | null }, code: string, via: 'email' | 'sms') {
  const text = `${code} is your ${EVENT.name} sign-in code. It expires in 10 minutes.`;
  if (via === 'sms' && to.phone) return sendSms(to.phone, text);
  if (to.email) return sendEmail(to.email, `Your sign-in code: ${code}`, text, emailHtml('Your sign-in code', [text], code));
}
