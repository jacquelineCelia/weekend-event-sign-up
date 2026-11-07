import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Links in "How was it?" emails: /rate/<token>. The token names one sign-up and is signed, so the link
 * lets whoever has the email rate that sign-up (and nothing else) without signing in.
 * Format: base64url("<booking id>:<expiry in unix seconds>") + "~" + signature. No "." in it: paths
 * ending in ".something" are treated as files.
 */
const DAYS_VALID = 60;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters');
  return s;
}
const sign = (payload: string) => createHmac('sha256', secret()).update(`rate:${payload}`).digest('base64url');

export function rateToken(bookingId: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + DAYS_VALID * 86400;
  const payload = Buffer.from(`${bookingId}:${exp}`).toString('base64url');
  return `${payload}~${sign(payload)}`;
}

/** The booking id in a valid, unexpired token; otherwise null. */
export function readRateToken(token: string, now = Date.now()): string | null {
  const [payload, sig, extra] = decodeURIComponent(token).split('~');
  if (!payload || !sig || extra !== undefined) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [id, exp] = Buffer.from(payload, 'base64url').toString().split(':');
  if (!/^[0-9a-f-]{36}$/i.test(id ?? '') || !(Number(exp) * 1000 > now)) return null;
  return id;
}
