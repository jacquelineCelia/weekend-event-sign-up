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

/**
 * Who this browser is signed in as: one person (after booking, or signing in by email), or
 * everyone who uses a phone number (after signing in by phone — a family may share one).
 */
export type Viewer = { kind: 'person'; personId: string } | { kind: 'phone'; phone: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeSession(v: Viewer | string) {
  const value = typeof v === 'string' ? `p:${v}` : v.kind === 'person' ? `p:${v.personId}` : `h:${v.phone}`;
  return `${value}.${sign(value)}`;
}

export function decodeViewer(raw: string | undefined): Viewer | null {
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const value = raw.slice(0, i);
  const given = Buffer.from(raw.slice(i + 1));
  const expected = Buffer.from(sign(value));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (value.startsWith('p:') && UUID.test(value.slice(2))) return { kind: 'person', personId: value.slice(2) };
  if (value.startsWith('h:') && /^\+\d{8,15}$/.test(value.slice(2))) return { kind: 'phone', phone: value.slice(2) };
  if (UUID.test(value)) return { kind: 'person', personId: value }; // cookies set before shared phones
  return null;
}

/** The person id, when signed in as one person. */
export function decodeSession(raw: string | undefined): string | null {
  const v = decodeViewer(raw);
  return v?.kind === 'person' ? v.personId : null;
}

export async function currentViewer() {
  return decodeViewer((await cookies()).get(COOKIE)?.value);
}

export async function currentPersonId() {
  return decodeSession((await cookies()).get(COOKIE)?.value);
}

/** remember = keep for the whole weekend; otherwise until the browser closes. */
export async function setViewerSession(v: Viewer, remember: boolean) {
  (await cookies()).set(COOKIE, encodeSession(v), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
}

export async function setPersonSession(personId: string, remember: boolean) {
  await setViewerSession({ kind: 'person', personId }, remember);
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
