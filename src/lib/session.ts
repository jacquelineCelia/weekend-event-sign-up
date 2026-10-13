import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

// A signed cookie remembers which attendee this browser belongs to.
const COOKIE = 'mw_person';

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters');
  return s;
}

const sign = (value: string) => createHmac('sha256', secret()).update(value).digest('base64url');

export function encodeSession(personId: string) {
  return `${personId}.${sign(personId)}`;
}

export function decodeSession(raw: string | undefined): string | null {
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const id = raw.slice(0, i);
  const given = Buffer.from(raw.slice(i + 1));
  const expected = Buffer.from(sign(id));
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

export async function currentPersonId() {
  return decodeSession((await cookies()).get(COOKIE)?.value);
}

/** remember = keep for the whole weekend; otherwise until the browser closes. */
export async function setPersonSession(personId: string, remember: boolean) {
  (await cookies()).set(COOKIE, encodeSession(personId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
}

export async function clearPersonSession() {
  (await cookies()).delete(COOKIE);
}

// ---------- Staff ----------
const STAFF_COOKIE = 'mw_staff';
const STAFF_DAYS = 7;

/** Constant-time check of the shared staff passcode (STAFF_PASSCODE). */
export function staffPasscodeMatches(given: string) {
  const expected = process.env.STAFF_PASSCODE;
  if (!expected || expected.length < 8) return false;
  const a = Buffer.from(sign(`passcode:${given}`));
  const b = Buffer.from(sign(`passcode:${expected}`));
  return timingSafeEqual(a, b);
}

export async function setStaffSession() {
  const until = Date.now() + STAFF_DAYS * 864e5;
  const value = `staff.${until}`;
  (await cookies()).set(STAFF_COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/staff',
    maxAge: STAFF_DAYS * 86400,
  });
}

export async function isStaff() {
  const raw = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!raw) return false;
  const i = raw.lastIndexOf('.');
  const value = raw.slice(0, i);
  const given = Buffer.from(raw.slice(i + 1));
  const expected = Buffer.from(sign(value));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  return Number(value.split('.')[1]) > Date.now();
}

export async function clearStaffSession() {
  (await cookies()).delete({ name: STAFF_COOKIE, path: '/staff' });
}
