import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { getPool, withTx } from './db';
import { normalizeEmail, normalizePhone } from './contact';
import { sendLoginCode } from './notify';
import type { Viewer } from './session';

export const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_15_MIN = 3;

const hash = (code: string) => createHmac('sha256', process.env.SESSION_SECRET ?? 'dev').update(code).digest('hex');

/**
 * Starts a sign-in. Always returns the same shape, so it never reveals who has signed up.
 * A phone number signs in everyone who uses it (families share phones); an email signs in one person.
 * Codes always go by email, never by text, so every text stays an account notification (carrier rules).
 */
export async function startLogin(identifier: string, lang: 'en' | 'zh' | 'zhs' = 'en'): Promise<{ ticket: string | null; via: 'email' | 'sms' | null; masked: string | null; limited?: boolean; many?: boolean }> {
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
  if (!people.length) return { ticket: randomUUID(), via: 'email', masked: mask(phone ?? email!) };

  // The code goes by email. On a shared phone, every email on that number gets it. A number with no
  // email on file (a walk-in) gets the same answer as an unknown one: there is nowhere to send a code.
  const emails = [...new Set(people.map((p) => p.email).filter((e): e is string => !!e))].slice(0, 5);
  if (phone && !emails.length) return { ticket: randomUUID(), via: 'email', masked: mask(phone) };
  const via = 'email' as const;

  const recent = await getPool().query<{ n: number }>(
    phone
      ? `select count(*)::int n from login_codes where phone = $1 and created_at > now() - interval '15 minutes'`
      : `select count(*)::int n from login_codes where person_id = $1 and created_at > now() - interval '15 minutes'`,
    [phone ?? people[0].id],
  );
  if (recent.rows[0].n >= MAX_CODES_PER_15_MIN) return { ticket: null, via, masked: null, limited: true };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const ins = await getPool().query<{ id: string }>(
    `insert into login_codes (person_id, phone, code_hash, sent_via, expires_at)
     values ($1, $2, $3, $4, now() + make_interval(mins => $5)) returning id`,
    [phone ? null : people[0].id, phone, hash(code), via, CODE_TTL_MIN],
  );
  const to = phone ? emails : [people[0].email!];
  for (const e of to) await sendLoginCode(e, code, lang);
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
