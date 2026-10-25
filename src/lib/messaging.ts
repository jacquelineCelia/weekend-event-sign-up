// Email (Resend; Twilio SendGrid still works as a fallback) and text messages (Twilio), called over
// plain HTTPS.
// Without credentials, messages are written to the server log instead, so
// every flow can be tested before the accounts exist.

export type Sent = { channel: 'email' | 'sms'; to: string; delivered: boolean; id?: string };

/** Messages recorded during tests (when MESSAGING_CAPTURE=1). */
export const outbox: { channel: 'email' | 'sms'; to: string; subject?: string; text: string }[] = [];

function capture(channel: 'email' | 'sms', to: string, text: string, subject?: string) {
  if (process.env.MESSAGING_CAPTURE === '1') outbox.push({ channel, to, text, subject });
  console.info(`[${channel} → ${to}]${subject ? ` ${subject} —` : ''} ${text.replace(/\s+/g, ' ').slice(0, 300)}`);
}

/** "Mindfulness Weekend <hello@example.com>" → { name, email } */
function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { email: m[2].trim(), ...(m[1] ? { name: m[1].replace(/^"|"$/g, '') } : {}) } : { email: from.trim() };
}

/**
 * Sends one email. Uses Resend when RESEND_API_KEY is set, otherwise SendGrid when SENDGRID_API_KEY
 * is set (so the switch-over needs no code change), otherwise just logs it.
 */
export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<Sent> {
  const from = process.env.EMAIL_FROM;
  const resendKey = process.env.RESEND_API_KEY;
  const key = process.env.SENDGRID_API_KEY;
  if (!from || (!resendKey && !key)) {
    // Say why in the server log (Vercel → Logs), so a missing setting is easy to spot.
    if (process.env.MESSAGING_CAPTURE !== '1') {
      const missing = [!from && 'EMAIL_FROM', !resendKey && !key && 'RESEND_API_KEY'].filter(Boolean).join(' and ');
      console.warn(`Email not sent (only logged): ${missing} not set in this environment.`);
    }
    capture('email', to, text, subject);
    return { channel: 'email', to, delivered: false };
  }
  if (resendKey) {
    // Resend: POST /emails, JSON in, { id } out. EMAIL_FROM ("Name <address>") is accepted as is,
    // and must be on a domain verified in Resend.
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, ...(html ? { html } : {}) }),
    });
    if (!res.ok) throw new Error(`Email failed (${res.status}): ${await res.text()}`);
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { channel: 'email', to, delivered: true, id: body.id };
  }
  // Twilio SendGrid v3 Mail Send. Success is 202 with an empty body.
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: parseFrom(from),
      subject,
      content: [{ type: 'text/plain', value: text }, ...(html ? [{ type: 'text/html', value: html }] : [])],
      // Transactional mail: don't rewrite links or add tracking pixels.
      tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
    }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${await res.text()}`);
  return { channel: 'email', to, delivered: true, id: res.headers.get('x-message-id') ?? undefined };
}

/** Twilio refuses to text a number that replied STOP (error 21610). */
export class SmsOptedOut extends Error {
  constructor(public phone: string) { super(`${phone} has opted out of texts (replied STOP)`); }
}

/**
 * Which Twilio sender a text goes out on. Each is its own A2P 10DLC campaign:
 *  - 'notify': confirmations, reminders and time changes (Account Notification), TWILIO_FROM;
 *  - 'codes': sign-in codes people ask for (2FA), TWILIO_CODES_FROM.
 * A number can belong to only one campaign, so the two must be different Messaging Services.
 */
export type SmsSender = 'notify' | 'codes';
const senderFrom = (s: SmsSender) => (s === 'codes' ? process.env.TWILIO_CODES_FROM : process.env.TWILIO_FROM);

export async function sendSms(to: string, text: string, sender: SmsSender = 'notify'): Promise<Sent> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = senderFrom(sender); // a phone number, or a Messaging Service SID (MG…)
  if (!sid || !token || !from) {
    capture('sms', to, text);
    return { channel: 'sms', to, delivered: false };
  }
  const form = new URLSearchParams({ To: to, Body: text });
  form.set(from.startsWith('MG') ? 'MessagingServiceSid' : 'From', from);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  if (!res.ok) {
    const raw = await res.text();
    let code: number | undefined;
    try { code = (JSON.parse(raw) as { code?: number }).code; } catch {}
    if (code === 21610) throw new SmsOptedOut(to);
    throw new Error(`SMS failed (${res.status}): ${raw}`);
  }
  const body = (await res.json()) as { sid?: string };
  return { channel: 'sms', to, delivered: true, id: body.sid };
}

/** True when real text messages can be sent. When false, reminders fall back to email. */
export const smsEnabled = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

/** True when sign-in codes can be texted (the 2FA campaign's Messaging Service is set). Otherwise codes go by email. */
export const codesBySmsEnabled = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_CODES_FROM);

/**
 * Whether the sign-in page shows the texting disclosure for sign-in codes: whenever codes are texted,
 * and also with SHOW_CODE_TEXT_DISCLOSURE=1, so carrier reviewers can see it while the 2FA campaign is
 * being reviewed (codes still go by email until TWILIO_CODES_FROM is set).
 */
export const showCodeTextDisclosure = () => codesBySmsEnabled() || process.env.SHOW_CODE_TEXT_DISCLOSURE === '1';
