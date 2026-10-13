// Email (Resend) and text messages (Twilio), called over plain HTTPS.
// Without credentials, messages are written to the server log instead, so
// every flow can be tested before the accounts exist.

export type Sent = { channel: 'email' | 'sms'; to: string; delivered: boolean; id?: string };

/** Messages recorded during tests (when MESSAGING_CAPTURE=1). */
export const outbox: { channel: 'email' | 'sms'; to: string; subject?: string; text: string }[] = [];

function capture(channel: 'email' | 'sms', to: string, text: string, subject?: string) {
  if (process.env.MESSAGING_CAPTURE === '1') outbox.push({ channel, to, text, subject });
  console.info(`[${channel} → ${to}]${subject ? ` ${subject} —` : ''} ${text.replace(/\s+/g, ' ').slice(0, 300)}`);
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<Sent> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    capture('email', to, text, subject);
    return { channel: 'email', to, delivered: false };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { id?: string };
  return { channel: 'email', to, delivered: true, id: body.id };
}

export async function sendSms(to: string, text: string): Promise<Sent> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM; // a phone number, or a Messaging Service SID (MG…)
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
  if (!res.ok) throw new Error(`SMS failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { sid?: string };
  return { channel: 'sms', to, delivered: true, id: body.sid };
}

/** True when real text messages can be sent. When false, reminders fall back to email. */
export const smsEnabled = () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
