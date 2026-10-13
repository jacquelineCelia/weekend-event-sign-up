import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { getPool, withTx } from './db';
import { normalizeEmail, normalizePhone } from './contact';
import { sendLoginCode } from './notify';
import { smsEnabled } from './messaging';

export const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_15_MIN = 3;

const hash = (code: string) => createHmac('sha256', process.env.SESSION_SECRET ?? 'dev').update(code).digest('hex');

/** Starts a sign-in. Always returns the same shape, so it never reveals who has signed up. */
export async function startLogin(identifier: string): Promise<{ ticket: string | null; via: 'email' | 'sms' | null; masked: string | null; limited?: boolean }> {
  const phone = normalizePhone(identifier);
  const email = phone ? null : normalizeEmail(identifier);
  if (!phone && !email) return { ticket: null, via: null, masked: null };

  const { rows } = await getPool().query<{ id: string; email: string | null; phone: string | null }>(
    phone ? 'select id, email, phone from people where phone = $1' : 'select id, email, phone from people where lower(email) = $1',
    [phone ?? email],
  );
  const person = rows[0];
  // Unknown people get the same answer as everyone else (a ticket that can never match),
  // so the form can't be used to find out who has signed up.
  if (!person) return { ticket: randomUUID(), via: phone && smsEnabled() ? 'sms' : 'email', masked: mask(phone ?? email!) };

  const via: 'email' | 'sms' = phone && smsEnabled() ? 'sms' : person.email ? 'email' : 'sms';
  const recent = await getPool().query<{ n: number }>(
    `select count(*)::int n from login_codes where person_id = $1 and created_at > now() - interval '15 minutes'`,
    [person.id],
  );
  if (recent.rows[0].n >= MAX_CODES_PER_15_MIN) return { ticket: null, via, masked: null, limited: true };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const ins = await getPool().query<{ id: string }>(
    `insert into login_codes (person_id, code_hash, sent_via, expires_at)
     values ($1, $2, $3, now() + make_interval(mins => $4)) returning id`,
    [person.id, hash(code), via, CODE_TTL_MIN],
  );
  await sendLoginCode(person, code, via);
  return { ticket: ins.rows[0].id, via, masked: mask(via === 'sms' ? person.phone! : person.email!) };
}

/** Checks a code; returns the person's id on success. */
export async function verifyLogin(ticket: string, code: string): Promise<{ personId: string } | { error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(ticket)) return { error: 'That code has expired. Ask for a new one.' };
  const clean = code.replace(/\D/g, '');
  return withTx(async (c) => {
    const r = await c.query<{ person_id: string; code_hash: string; attempts: number; expired: boolean; used: boolean }>(
      `select person_id, code_hash, attempts, expires_at < now() as expired, used_at is not null as used
         from login_codes where id = $1 for update`,
      [ticket],
    );
    const row = r.rows[0];
    if (!row || row.expired || row.used || row.attempts >= MAX_ATTEMPTS) return { error: 'That code has expired. Ask for a new one.' };
    const ok = clean.length === 6 && timingSafeEqual(Buffer.from(hash(clean)), Buffer.from(row.code_hash));
    if (!ok) {
      await c.query('update login_codes set attempts = attempts + 1 where id = $1', [ticket]);
      const left = MAX_ATTEMPTS - row.attempts - 1;
      return { error: left > 0 ? `That code didn't match. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many tries. Ask for a new code.' };
    }
    await c.query('update login_codes set used_at = now() where id = $1', [ticket]);
    return { personId: row.person_id };
  });
}

function mask(v: string) {
  if (v.includes('@')) {
    const [u, d] = v.split('@');
    return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`;
  }
  return `••• ••• ${v.slice(-4)}`;
}
