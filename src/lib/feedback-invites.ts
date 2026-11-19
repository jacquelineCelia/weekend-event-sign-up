import { getPool } from './db';
import { EVENT, type Lang } from './event';
import { toSimplified } from './hans';
import { appUrl, emailHtml } from './notify';
import { sendEmail } from './messaging';

/**
 * Feedback emails sent from the staff page /staff/feedback-email, in two rounds:
 * 'invite' (the first invitation, table feedback_invites) and 'reminder' (last-day reminder,
 * table feedback_reminders). Each round goes to every email address with a sign-up on the event
 * days, cancelled ones included (user's choice), one email per address, greeting only whoever
 * signed up first on it (user's request), in that person's language.
 * Skipped in both rounds: addresses on a feedback form, and addresses staff pasted as "already gave
 * feedback" (table feedback_skips). Each round sends to an address at most once.
 */
export type Invitee = { email: string; names: string[]; lang: Lang };
export type Round = 'invite' | 'reminder';
const TABLE: Record<Round, string> = { invite: 'feedback_invites', reminder: 'feedback_reminders' };

const DAYS = () => EVENT.days.map((d) => d.date);

export async function inviteSummary(round: Round = 'invite') {
  const pool = getPool();
  const { rows } = await pool.query<{ email: string; names: string[]; lang: string; state: string }>(
    `with signed as (
       select lower(p.email) as email, p.name, coalesce(p.lang, 'zh') as lang, min(b.created_at) as first_at
         from bookings b join slots s on s.id = b.slot_id join people p on p.id = b.person_id
        where b.status in ('confirmed', 'cancelled') and coalesce(p.email, '') <> ''
          and (s.starts_at at time zone $1)::date = any ($2::date[])
        group by lower(p.email), p.name, p.lang
     ), byemail as (
       select email, array_agg(name order by first_at) as names, (array_agg(lang order by first_at))[1] as lang
         from signed group by email
     )
     select e.email, e.names, e.lang,
            case when exists (select 1 from ${TABLE[round]} r where r.email = e.email) then 'sent'
                 when exists (select 1 from event_feedback f where lower(f.email) = e.email and f.age is not null) then 'filled'
                 when exists (select 1 from feedback_skips k where k.email = e.email) then 'listed'
                 else 'todo' end as state
       from byemail e
      order by e.names[1]`,
    [EVENT.timeZone, DAYS()],
  );
  const noEmail = await pool.query<{ n: number }>(
    `select count(distinct p.id)::int as n from bookings b join slots s on s.id = b.slot_id join people p on p.id = b.person_id
      where b.status in ('confirmed', 'cancelled') and coalesce(p.email, '') = '' and (s.starts_at at time zone $1)::date = any ($2::date[])`,
    [EVENT.timeZone, DAYS()],
  );
  const by = (st: string) => rows.filter((r) => r.state === st).map((r) => ({ email: r.email, names: r.names, lang: (r.lang as Lang) }));
  return { todo: by('todo'), sent: by('sent'), filled: by('filled'), listed: by('listed'), noEmail: noEmail.rows[0].n };
}

/** Marks pasted addresses as "already gave feedback", and reports which group each one is in. */
export async function addSkips(text: string, round: Round = 'invite') {
  const emails = [...new Set((text.match(/[^\s,;，；、<>()"']+@[^\s,;，；、<>()"']+\.[^\s,;，；、<>()"']+/g) ?? []).map((e) => e.toLowerCase()))];
  if (emails.length)
    await getPool().query(
      `insert into feedback_skips (email) select unnest($1::text[]) on conflict (email) do nothing`,
      [emails],
    );
  // Say where each pasted address ended up: a participant who already filled the form on the
  // website was never on the sending list, and must not read as "not a participant".
  const s = await inviteSummary(round);
  const has = (rows: Invitee[]) => new Set(rows.map((x) => x.email));
  const [listed, filled, sent] = [has(s.listed), has(s.filled), has(s.sent)];
  const count = (set: Set<string>) => emails.filter((e) => set.has(e)).length;
  const removed = count(listed), alreadyFilled = count(filled), alreadySent = count(sent);
  return {
    found: emails.length, removed, alreadyFilled, alreadySent,
    notFound: emails.filter((e) => !listed.has(e) && !filled.has(e) && !sent.has(e)),
  };
}

/** Undo a pasted address. */
export async function removeSkip(email: string) {
  await getPool().query(`delete from feedback_skips where email = $1`, [email.toLowerCase()]);
}

const ZH = {
  subject: '邀請您分享這個週末的心得與回饋',
  title: '分享您的心得與回饋',
  hello: (names: string[]) => `${names.join('、')}，您好：`,
  lines: [
    '非常感恩您這個週末一同參與憶師恩法會及療癒體驗活動。',
    '誠摯邀請您花幾分鐘填寫回饋表單，分享您的心得與受用，也給護持團隊一些回饋與建議，讓我們下一次的相遇更加美好。',
  ],
  cta: '填寫回饋表單',
  thanks: '感恩您！',
};
const EN = {
  subject: 'Please share your feedback on the weekend',
  title: 'Share your reflections and feedback',
  hello: (names: string[]) => `Dear ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]},`,
  lines: [
    'Thank you so much for joining us this weekend for the Memorial Ceremony for Late Master and the mindfulness activities.',
    'We warmly invite you to take a few minutes to fill out our feedback form — share your reflections and what you took away, and let our volunteer team know how we did, so our next gathering can be even better.',
  ],
  cta: 'Fill out the feedback form',
  thanks: 'Thank you!',
};

/** Last-day reminder (round 'reminder', 2026-11-19): the form closes 11/20 at noon. Subject is the user's wording. */
const ZH_REMIND: typeof ZH = {
  subject: '【憶師恩法會暨療癒活動回饋】把握最後一天機會',
  title: '回饋表單明天中午截止',
  hello: ZH.hello,
  lines: [
    '感恩您上週末參與憶師恩法會及療癒體驗活動。',
    '回饋表單將於明天 11 月 20 日（星期五）中午 12 點（紐約時間）截止。如果您還沒有填寫，誠摯邀請您把握最後一天機會，花幾分鐘分享您的心得與受用，也給護持團隊一些回饋與建議。',
    '如果您已經填寫，非常感恩您，請忽略這封信。',
  ],
  cta: '填寫回饋表單',
  thanks: '感恩您！',
};
const EN_REMIND: typeof EN = {
  subject: '[Memorial Ceremony & Mindfulness Activities Feedback] Last day to share',
  title: 'Feedback closes tomorrow at noon',
  hello: EN.hello,
  lines: [
    'Thank you for joining us last weekend for the Memorial Ceremony for Late Master and the mindfulness activities.',
    'Our feedback form closes tomorrow, Friday, November 20, at 12 noon (New York time). If you haven’t filled it out yet, we warmly invite you to take this last chance to share your reflections and let our volunteer team know how we did.',
    'If you’ve already filled it out, thank you so much — please ignore this email.',
  ],
  cta: 'Fill out the feedback form',
  thanks: 'Thank you!',
};

/** One round's email in one language: subject, plain text and HTML. */
export function inviteEmail(lang: Lang, names: string[], round: Round = 'invite') {
  // Mainland wording: 反馈 (as on the form), not the converted 回馈.
  const z = (s: string) => (lang === 'zhs' ? toSimplified(s).replaceAll('回馈', '反馈') : s);
  const t = round === 'reminder' ? (lang === 'en' ? EN_REMIND : ZH_REMIND) : lang === 'en' ? EN : ZH;
  const url = `${appUrl()}/${lang === 'en' ? 'en' : lang === 'zhs' ? 'cn' : 'zh'}/feedback`;
  const lines = [t.hello(names), ...t.lines].map(z);
  const subject = z(t.subject);
  const text = [...lines, `${z(t.cta)}: ${url}`, z(t.thanks)].join('\n\n');
  // Top line: 療癒週末 (user's wording for this email), not the site's event name.
  const header = lang === 'en' ? 'Mindfulness Weekend' : z('療癒週末');
  const html = emailHtml(lang, z(t.title), lines, null, { href: url, label: z(t.cta) }, header).replace(
    '</div></div></body>',
    `<p style="margin:14px 0 0">${z(t.thanks)}</p></div></div></body>`,
  );
  return { subject, text, html };
}

export async function sendInviteTest(to: string, lang: Lang, round: Round = 'invite') {
  const m = inviteEmail(lang, [lang === 'en' ? 'Mei Lin' : '王小明'], round);
  return sendEmail(to, `[測試 Test] ${m.subject}`, m.text, m.html);
}

/**
 * Sends the next batch. Each address is claimed in the table first (insert … on conflict do nothing),
 * so two clicks or two staff devices can't send to the same address twice. A failed send is un-claimed
 * so it can be retried. Returns how many went out, how many failed and how many are left.
 */
export async function sendInviteBatch(limit = 25, round: Round = 'invite') {
  const pool = getPool();
  const { todo } = await inviteSummary(round);
  const table = TABLE[round];
  let sent = 0;
  const failed: { email: string; error: string }[] = [];
  for (const r of todo.slice(0, limit)) {
    const claim = await pool.query(
      round === 'invite'
        ? `insert into feedback_invites (email, status, names, lang) values ($1, 'sent', $2, $3) on conflict (email) do nothing returning email`
        : `insert into feedback_reminders (email, names, lang) values ($1, $2, $3) on conflict (email) do nothing returning email`,
      [r.email, r.names.join('、'), r.lang],
    );
    if (!claim.rowCount) continue;
    try {
      // Shared address: greet only whoever signed up first (user's request).
      const m = inviteEmail(r.lang, r.names.slice(0, 1), round);
      const res = await sendEmail(r.email, m.subject, m.text, m.html);
      if (!res.delivered && process.env.MESSAGING_CAPTURE !== '1') throw new Error('Email is not set up in this environment (EMAIL_FROM / RESEND_API_KEY).');
      await pool.query(`update ${table} set resend_id = $2, at = now() where email = $1`, [r.email, res.id ?? null]);
      sent++;
    } catch (e) {
      await pool.query(`delete from ${table} where email = $1`, [r.email]);
      failed.push({ email: r.email, error: e instanceof Error ? e.message.slice(0, 200) : String(e) });
      if (failed.length >= 3) break; // something is wrong with sending; stop and show it
    }
    await new Promise((ok) => setTimeout(ok, 250)); // stay well under Resend's per-second limit
  }
  const left = (await inviteSummary(round)).todo.length;
  return { sent, failed, left };
}
