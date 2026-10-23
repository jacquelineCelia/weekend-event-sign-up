import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { getPool, withTx } from './db';
import { normalizeEmail, normalizePhone } from './contact';
import { sendLoginCode } from './notify';
import { SmsOptedOut, codesBySmsEnabled } from './messaging';
import type { Viewer } from './session';

export const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_15_MIN = 3;

const hash = (code: string) => createHmac('sha256', process.env.SESSION_SECRET ?? 'dev').update(code).digest('hex');

/**
 * Starts a sign-in. Always returns the same shape, so it never reveals who has signed up.
 * A phone number signs in everyone who uses it (families share phones); an email signs in one person.
 *
 * Where the code goes: with `allowText` (the sign-in page, where the texting disclosure sits next to
 * the button) and the sign-in codes (2FA) sender set up, a phone number gets the code by text.
 * Otherwise codes go by email (on a shared phone, to every email on that number). Codes never go
 * through the notifications sender, so that campaign stays account notifications only.
 */
export async function startLogin(identifier: string, lang: 'en' | 'zh' | 'zhs' = 'en', opts: { allowText?: boolean } = {}): Promise<{ ticket: string | null; via: 'email' | 'sms' | null; masked: string | null; limited?: boolean; many?: boolean }> {
  const phone = normalizePhone(identifier);
  const email = phone ? null : normalizeEmail(identifier);
  if (!phone && !email) return { ticket: null, via: null, masked: null };

  const { rows: people } = await getPool().query<{ id: string; email: string | null; phone: string | null }>(
    phone
      ? 'select id, email, phone from people where phone = $1 order by created_at'
      : 'select id, email, phone from people where lower(email) = $1',
    [phone ?? email],
  );
  // Unknown people get the same answer as everyone else (a ticket that can never match),
  // so the form can't be used to find out who has signed up.
  const byText = !!phone && !!opts.allowText && codesBySmsEnabled();
  if (!people.length) return { ticket: randomUUID(), via: byText ? 'sms' : 'email', masked: mask(phone ?? email!) };

  const emails = [...new Set(people.map((p) => p.email).filter((e): e is string => !!e))].slice(0, 5);
  // By email, a number with no email on file (a walk-in) gets the same answer as an unknown one.
  if (phone && !byText && !emails.length) return { ticket: randomUUID(), via: 'email', masked: mask(phone) };
  let via: 'email' | 'sms' = byText ? 'sms' : 'email';

  const recent = await getPool().query<{ n: number }>(
    phone
      ? `select count(*)::int n from login_codes where phone = $1 and created_at > now() - interval '15 minutes'`
      : `select count(*)::int n from login_codes where person_id = $1 and created_at > now() - interval '15 minutes'`,
    [phone ?? people[0].id],
  );
  if (recent.rows[0].n >= MAX_CODES_PER_15_MIN) return { ticket: null, via, masked: null, limited: true };

  // Only the newest code works: earlier unused codes for the same phone or person stop working now.
  // When there was one, a texted code says it's a new one (the second wording in the 2FA campaign).
  const replaced = await getPool().query(
    phone
      ? `update login_codes set expires_at = now() where phone = $1 and used_at is null and expires_at > now()`
      : `update login_codes set expires_at = now() where person_id = $1 and used_at is null and expires_at > now()`,
    [phone ?? people[0].id],
  );
  const again = (replaced.rowCount ?? 0) > 0;
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const ins = await getPool().query<{ id: string }>(
    `insert into login_codes (person_id, phone, code_hash, sent_via, expires_at)
     values ($1, $2, $3, $4, now() + make_interval(mins => $5)) returning id`,
    [phone ? null : people[0].id, phone, hash(code), via, CODE_TTL_MIN],
  );
  if (via === 'sms') {
    try {
      await sendLoginCode({ phone: phone! }, code, lang, again);
      return { ticket: ins.rows[0].id, via, masked: mask(phone!) };
    } catch (e) {
      // The number replied STOP to the sign-in codes sender: use email if there is one.
      if (!(e instanceof SmsOptedOut) || !emails.length) throw e;
      via = 'email';
      await getPool().query(`update login_codes set sent_via = 'email' where id = $1`, [ins.rows[0].id]);
    }
  }
  const to = phone ? emails : [people[0].email!];
  for (const e of to) await sendLoginCode({ email: e }, code, lang);
  return { ticket: ins.rows[0].id, via, masked: to.map(mask).join(' / '), many: to.length > 1 };
}

/** Checks a code; on success says who is now signed in (one person, or everyone on a phone number). */
export async function verifyLogin(ticket: string, code: string): Promise<{ viewer: Viewer } | { error: 'code_expired' | 'code_wrong' | 'too_many_tries'; left?: number }> {
  if (!/^[0-9a-f-]{36}$/i.test(ticket)) return { error: 'code_expired' };
  const clean = code.replace(/\D/g, '');
  return withTx(async (c) => {
    const r = await c.query<{ person_id: string | null; phone: string | null; code_hash: string; attempts: number; expired: boolean; used: boolean }>(
      `select person_id, phone, code_hash, attempts, expires_at < now() as expired, used_at is not null as used
         from login_codes where id = $1 for update`,
      [ticket],
    );
    const row = r.rows[0];
    if (!row || row.expired || row.used || row.attempts >= MAX_ATTEMPTS) return { error: 'code_expired' };
    const ok = clean.length === 6 && timingSafeEqual(Buffer.from(hash(clean)), Buffer.from(row.code_hash));
    if (!ok) {
      await c.query('update login_codes set attempts = attempts + 1 where id = $1', [ticket]);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      return left > 0 ? { error: 'code_wrong', left } : { error: 'too_many_tries' };
    }
    await c.query('update login_codes set used_at = now() where id = $1', [ticket]);
    const viewer: Viewer = row.phone ? { kind: 'phone', phone: row.phone } : { kind: 'person', personId: row.person_id! };
    return { viewer };
  });
}

function mask(v: string) {
  if (v.includes('@')) {
    const [u, d] = v.split('@');
    return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`;
  }
  return `••• ••• ${v.slice(-4)}`;
}
