import Link from 'next/link';
import { roster, seatCounts, sessionsForDay } from '@/lib/staff';
import { EVENT, addMinutes, dayByKey, dayOf, dayText, fmtTimeL, requestTime } from '@/lib/event';
import { localText } from '@/lib/hans';
import { nameRuns } from '@/components/ActivityName';
import { zhBold } from '@/lib/i18n';
import { staffLang } from '@/lib/staff-lang';
import { sdict } from '@/lib/staff-i18n';
import { Plus } from '@/components/icons';
import Roster from './Roster';
import AutoRefresh from './AutoRefresh';
import FilterList from './FilterList';
import RememberSlot from './RememberSlot';
import { cookies } from 'next/headers';
import { getPool } from '@/lib/db';
import { LAST_SLOT_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function CheckIn({ searchParams }: { searchParams: Promise<{ day?: string; slot?: string; past?: string }> }) {
  const sp = await searchParams;
  const lang = await staffLang();
  const t = sdict(lang);
  const fmtTime = (d: Date) => fmtTimeL(d, lang);
  const name = (s: { activityName: string; activityNameZh: string }) => localText(s.activityName, s.activityNameZh, lang);
  const place = (s: { place: string; placeZh: string }) => localText(s.place, s.placeZh, lang);
  const now = requestTime();
  const today = dayOf(new Date(now));
  // Coming back via the Check-in tab (no day or session chosen): reopen the session staff last worked on,
  // e.g. the one they just signed a walk-in up for — unless it has finished.
  let slotId = sp.slot;
  let lastDay: (typeof EVENT.days)[number] | null = null;
  if (!sp.slot && !sp.day) {
    const last = (await cookies()).get(LAST_SLOT_COOKIE)?.value ?? '';
    if (/^[0-9a-f-]{36}$/i.test(last)) {
      const r = (await getPool().query<{ starts_at: Date; duration_min: number }>(
        'select s.starts_at, a.duration_min from slots s join activities a on a.id = s.activity_id where s.id = $1', [last],
      )).rows[0];
      if (r && addMinutes(r.starts_at, r.duration_min).getTime() > now) { slotId = last; lastDay = dayOf(r.starts_at); }
    }
  }
  const day = sp.day ? dayByKey(sp.day) : lastDay ?? today ?? EVENT.days[0];
  const all = await sessionsForDay(day.date);
  const ends = (s: (typeof all)[number]) => addMinutes(s.startsAt, s.durationMin).getTime();
  // Finished sessions are hidden unless staff ask to see them (e.g. to look up who came).
  const showPast = sp.past === '1';
  const finished = all.filter((s) => ends(s) <= now).length;
  const sessions = showPast ? all : all.filter((s) => ends(s) > now);
  const sel = all.find((s) => s.slotId === slotId) ?? sessions[0] ?? (showPast ? all[0] : undefined);
  const people = sel ? await roster(sel.slotId, lang) : [];
  const seating = sel ? await seatCounts(sel.slotId, lang) : [];

  const tag = (s: (typeof sessions)[number]) => {
    const start = s.startsAt.getTime();
    if (now >= ends(s)) return { text: t.done, now: false };
    if (now >= start) return { text: t.inProgress, now: true };
    const mins = Math.round((start - now) / 60000);
    if (mins <= 60) return { text: t.startsIn(mins), now: true };
    return null;
  };
  const href = (q: { day?: string; slot?: string; past?: boolean }) =>
    `/staff?day=${q.day ?? day.key}${q.slot ? `&slot=${q.slot}` : ''}${(q.past ?? (showPast && !q.day)) ? '&past=1' : ''}`;

  let note = '';
  if (sel) {
    const open = Math.max(0, sel.capacity - sel.booked);
    const notHere = sel.booked - sel.arrived;
    const tg = tag(sel);
    if (sel.booked === 0) note = t.noteNoSignups(sel.capacity);
    else if (tg?.now && notHere > 0) note = t.noteNotHere(tg.text, notHere, open);
    else if (tg?.now) note = t.noteAllIn(tg.text, open);
  }

  return (
    <div className="staffbody">
      <AutoRefresh seconds={20} />
      {sel ? <RememberSlot slotId={sel.slotId} /> : null}
      <aside className="staffside scrollside" aria-label={t.sessions}>
        <nav className="segment" aria-label={t.dayNav}>
          {EVENT.days.map((d) => (
            <Link key={d.key} href={href({ day: d.key })} aria-current={d.key === day.key ? 'true' : undefined}>{dayText(d, 'label', lang)}</Link>
          ))}
        </nav>
        <h2 className="h2" style={{ fontSize: 18, color: 'var(--ink-2)', margin: '8px 0 0' }}>{t.sessions}</h2>
        <FilterList lang={lang} label={t.searchSessions} placeholder={t.searchSessionsHint} noun="session" 
          items={sessions.map((s) => {
            const tg = tag(s);
            return {
              key: s.slotId,
              search: `${s.activityName} ${s.activityNameZh} ${name(s)} ${s.place} ${place(s)} ${fmtTime(s.startsAt)} ${fmtTimeL(s.startsAt, 'en')} ${fmtTimeL(s.startsAt, 'en').replace(/\s?[AP]M$/, '')} ${tg?.text ?? ''}`,
              node: (
                <Link className="session" href={href({ slot: s.slotId })} aria-current={s.slotId === sel?.slotId ? 'true' : undefined}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(s.startsAt)}</span>
                    {tg ? <span className={`stag ${tg.now ? 'now' : ''}`}>{tg.text}</span> : null}
                  </span>
                  <span className={`serif${zhBold(name(s))}`} style={{ fontSize: 17 }}>{nameRuns(name(s))}</span>
                  <span className="meta">{t.sessionMeta(place(s), s.booked, s.capacity, s.arrived)}</span>
                </Link>
              ),
            };
          })} />
        {all.length === 0 ? <p className="muted">{t.noSessionsDay}</p>
          : sessions.length === 0 ? <p className="muted">{t.allSessionsFinished(dayText(day, 'label', lang))}</p> : null}
        {finished > 0 ? (
          <Link href={href({ slot: sel && (showPast ? ends(sel) > now : true) ? sel.slotId : undefined, past: !showPast })}
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--moss)', padding: '4px' }}>
            {showPast ? t.hideFinishedSessions : t.showFinishedSessions(finished)}
          </Link>
        ) : null}
      </aside>

      {sel ? (
        <main className="staffmain">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <div className="stack" style={{ gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--moss)' }}>{dayText(day, 'short', lang)} · {fmtTime(sel.startsAt)} · {place(sel)}</span>
              <h1 className={`h1${zhBold(name(sel))}`} style={{ fontSize: 34 }}>{nameRuns(name(sel))}</h1>
              {sel.instructor ? <span className="muted" style={{ fontSize: 14 }}>{t.ledBy(localText(sel.instructor, sel.instructorZh, lang))}</span> : null}
            </div>
            <Link className="btn" style={{ minHeight: 50, background: 'var(--forest)', fontSize: 15 }} href={`/staff/walk-in?slot=${sel.slotId}`}>
              <Plus size={18} /> {t.addWalkIn}
            </Link>
          </div>
          <div className="stats">
            <div className="stack"><span>{t.capacity}</span><span>{sel.capacity}</span></div>
            <div className="stack"><span>{t.booked}</span><span>{sel.booked}</span></div>
            <div className="stack"><span>{t.checkedIn}</span><span style={{ color: 'var(--moss)' }}>{sel.arrived}</span></div>
            <div className="stack"><span>{t.openSpots}</span><span style={{ color: 'var(--ochre)' }}>{Math.max(0, sel.capacity - sel.booked)}</span></div>
          </div>
          {seating.length ? (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-2)' }}>
              <b>{t.seatingBooked}</b>{lang === 'en' ? ' ' : ''}{seating.map((x) => `${x.name} ${x.booked}/${x.capacity}`).join(' · ')}
            </p>
          ) : null}
          {note ? <div className="note" role="status" style={{ fontSize: 14 }}>{note}</div> : null}
          <Roster key={sel.slotId} rows={people} lang={lang} />
        </main>
      ) : null}
    </div>
  );
}
