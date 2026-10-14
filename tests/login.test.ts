import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { startLogin, verifyLogin } from '@/lib/login';
import { outbox } from '@/lib/messaging';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();
let personId: string;

beforeEach(async () => {
  await pool.query('truncate login_codes, ratings, bookings, people, slots, activities cascade');
  outbox.length = 0;
  personId = (await pool.query<{ id: string }>(
    `insert into people (name, email, phone) values ('Jordan Lee', 'jordan@example.com', '+14125550148') returning id`,
  )).rows[0].id;
});
afterAll(() => pool.end());

const lastCode = () => outbox.at(-1)!.text.match(/\b(\d{6})\b/)![1];

describe('sign in with a one-time code', () => {
  it('emails a code (texting not set up) and accepts it once', async () => {
    const r = await startLogin('(412) 555-0148');
    expect(r.via).toBe('email');
    expect(r.masked).toBe('jo••••@example.com');
    expect(outbox.at(-1)).toMatchObject({ channel: 'email', to: 'jordan@example.com' });
    const code = lastCode();
    expect(await verifyLogin(r.ticket!, code)).toEqual({ viewer: { kind: 'phone', phone: '+14125550148' } });
    expect(await verifyLogin(r.ticket!, code)).toHaveProperty('error');
  });

  it('finds people by email too, case-insensitively', async () => {
    const r = await startLogin('JORDAN@example.com');
    expect(await verifyLogin(r.ticket!, lastCode())).toEqual({ viewer: { kind: 'person', personId } });
  });

  it('gives an unknown person the same kind of answer, and no code', async () => {
    const r = await startLogin('nobody@example.com');
    expect(r.ticket).toMatch(/^[0-9a-f-]{36}$/);
    expect(outbox).toHaveLength(0);
    expect(await verifyLogin(r.ticket!, '123456')).toHaveProperty('error');
  });

  it('locks a code after 5 wrong tries', async () => {
    const r = await startLogin('jordan@example.com');
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect(await verifyLogin(r.ticket!, wrong)).toHaveProperty('error');
    expect(await verifyLogin(r.ticket!, code)).toHaveProperty('error');
  });

  it('expires codes after 10 minutes', async () => {
    const r = await startLogin('jordan@example.com');
    await pool.query(`update login_codes set expires_at = now() - interval '1 second'`);
    expect(await verifyLogin(r.ticket!, lastCode())).toHaveProperty('error');
  });

  it('limits how many codes are sent', async () => {
    for (let i = 0; i < 3; i++) await startLogin('jordan@example.com');
    expect((await startLogin('jordan@example.com')).limited).toBe(true);
  });
});
