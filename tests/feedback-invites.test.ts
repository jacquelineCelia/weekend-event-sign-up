import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPool } from '@/lib/db';
import { addSkips, inviteEmail, inviteSummary, removeSkip, sendInviteBatch } from '@/lib/feedback-invites';
import { outbox } from '@/lib/messaging';

vi.spyOn(console, 'info').mockImplementation(() => {});
const pool = getPool();

/** A confirmed sign-up (inserted directly: the event days are in the past, so holds would be refused). */
async function signed(name: string, email: string | null, startsAt: string, opts: { lang?: string; status?: string } = {}) {
  const a = await pool.query<{ id: string }>(`insert into activities (name, place, duration_min) values ('Tea', 'Hall', 50) returning id`);
  const s = await pool.query<{ id: string }>(`insert into slots (activity_id, starts_at, capacity) values ($1, $2, 10) returning id`, [a.rows[0].id, startsAt]);
  const p = await pool.query<{ id: string }>(
    `insert into people (name, email, phone, lang) values ($1, $2, $3, $4) returning id`,
    [name, email, email ? null : '+12125550100', opts.lang ?? 'zh'],
  );
  await pool.query(
    `insert into bookings (slot_id, person_id, party_size, status, source, code, confirmed_at) values ($1, $2, 1, $3, 'online', upper(substr(md5(random()::text), 1, 4)), now())`,
    [s.rows[0].id, p.rows[0].id, opts.status ?? 'confirmed'],
  );
}

beforeEach(async () => {
  await pool.query('truncate feedback_invites, event_feedback, login_codes, bookings, people, slots, activities cascade');
  outbox.length = 0;
});
afterAll(() => pool.end());

describe('feedback invitation emails', () => {
  it('one email per address, skipping cancelled, other days, no email, filled forms and pasted addresses', async () => {
    await signed('王小明', 'wang@example.com', '2026-11-14T14:50:00-05:00');
    await signed('王小美', 'Wang@Example.com', '2026-11-15T09:50:00-05:00');
    await signed('Mei Lin', 'mei@example.com', '2026-11-14T16:00:00-05:00', { lang: 'en' });
    await signed('Gone', 'gone@example.com', '2026-11-14T16:00:00-05:00', { status: 'cancelled' });
    await signed('Test', 'test@example.com', '2026-11-20T10:00:00-05:00');
    await signed('Walk', null, '2026-11-14T16:00:00-05:00');
    await signed('Filled', 'filled@example.com', '2026-11-15T11:00:00-05:00', { lang: 'zhs' });
    await signed('Listed', 'listed@example.com', '2026-11-15T11:00:00-05:00');
    await pool.query(`insert into event_feedback (name, email, lang, age, activity_ids) values ('F', 'FILLED@example.com', 'zhs', '60s', '{}')`);
    expect(await addSkips('Listed <LISTED@example.com>, other@x.org；')).toEqual({ found: 2, removed: 1 });

    const s = await inviteSummary();
    expect(s.todo).toEqual([
      { email: 'mei@example.com', names: ['Mei Lin'], lang: 'en' },
      { email: 'wang@example.com', names: ['王小明', '王小美'], lang: 'zh' },
    ]);
    expect(s.filled.map((x) => x.email)).toEqual(['filled@example.com']);
    expect(s.listed.map((x) => x.email)).toEqual(['listed@example.com']);
    expect(s.noEmail).toBe(1);

    await removeSkip('listed@example.com');
    expect((await inviteSummary()).todo).toHaveLength(3);
  });

  it('sends each address once, in its language, and never again', async () => {
    await signed('王小明', 'wang@example.com', '2026-11-14T14:50:00-05:00');
    await signed('王小美', 'wang@example.com', '2026-11-15T09:50:00-05:00');
    await signed('Mei Lin', 'mei@example.com', '2026-11-14T16:00:00-05:00', { lang: 'en' });
    await signed('李', 'li@example.com', '2026-11-14T16:00:00-05:00', { lang: 'zhs' });
    expect(await sendInviteBatch(2)).toEqual({ sent: 2, failed: [], left: 1 });
    expect(await sendInviteBatch(25)).toEqual({ sent: 1, failed: [], left: 0 });
    expect(await sendInviteBatch(25)).toEqual({ sent: 0, failed: [], left: 0 });
    expect(outbox).toHaveLength(3);
    const by = (to: string) => outbox.find((m) => m.to === to)!;
    expect(by('wang@example.com').text).toContain('王小明、王小美，您好：');
    expect(by('wang@example.com').text).toContain('/zh/feedback');
    expect(by('mei@example.com').subject).toBe('Please share your feedback on the weekend');
    expect(by('mei@example.com').text).toContain('/en/feedback');
    expect(by('li@example.com').text).toContain('非常感恩您这个周末');
    expect(by('li@example.com').text).toContain('/cn/feedback');
    expect((await inviteSummary()).sent).toHaveLength(3);
  });

  it('greets several English names naturally', () => {
    expect(inviteEmail('en', ['Ann', 'Bo', 'Cy']).text.startsWith('Dear Ann, Bo and Cy,')).toBe(true);
  });
});
