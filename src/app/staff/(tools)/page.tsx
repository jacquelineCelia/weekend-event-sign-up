import Link from 'next/link';
import { roster, sessionsForDay } from '@/lib/staff';
import { EVENT, addMinutes, dayByKey, dayOf, fmtTime, requestTime } from '@/lib/event';
import { Plus } from '@/components/icons';
import Roster from './Roster';
import AutoRefresh from './AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function CheckIn({ searchParams }: { searchParams: Promise<{ day?: string; slot?: string }> }) {
  const sp = await searchParams;
  const now = requestTime();
  const today = dayOf(new Date(now));
  const day = sp.day ? dayByKey(sp.day) : today ?? EVENT.days[0];
  const sessions = await sessionsForDay(day.date);
  const ends = (s: (typeof sessions)[number]) => addMinutes(s.startsAt, s.durationMin).getTime();
  const sel = sessions.find((s) => s.slotId === sp.slot) ?? sessions.find((s) => ends(s) > now) ?? sessions[0];
  const people = sel ? await roster(sel.slotId) : [];

  const tag = (s: (typeof sessions)[number]) => {
    const start = s.startsAt.getTime();
    if (now >= ends(s)) return { text: 'Done', now: false };
    if (now >= start) return { text: 'In progress', now: true };
    const mins = Math.round((start - now) / 60000);
    if (mins <= 60) return { text: `Starts in ${mins} min`, now: true };
    return null;
  };
  const href = (q: { day?: string; slot?: string }) => `/staff?day=${q.day ?? day.key}${q.slot ? `&slot=${q.slot}` : ''}`;

  let note = '';
  if (sel) {
    const open = Math.max(0, sel.capacity - sel.booked);
    const notHere = sel.booked - sel.arrived;
    const t = tag(sel);
    if (sel.booked === 0) note = `No sign-ups yet. All ${sel.capacity} spots are open for walk-ins.`;
    else if (t?.now && notHere > 0) note = `${t.text} · ${notHere} ${notHere === 1 ? 'person' : 'people'} not here yet.${open ? ` ${open} open for walk-ins.` : ''}`;
    else if (t?.now) note = `${t.text} · everyone is checked in.${open ? ` ${open} ${open === 1 ? 'spot' : 'spots'} still open for walk-ins.` : ''}`;
  }

  return (
    <div className="staffbody">
      <AutoRefresh seconds={20} />
      <aside className="staffside" aria-label="Sessions">
        <nav className="segment" aria-label="Day">
          {EVENT.days.map((d) => (
            <Link key={d.key} href={href({ day: d.key })} aria-current={d.key === day.key ? 'true' : undefined}>{d.label}</Link>
          ))}
        </nav>
        <h2 className="h2" style={{ fontSize: 18, color: 'var(--ink-2)', margin: '8px 0 0' }}>Sessions</h2>
        {sessions.map((s) => {
          const t = tag(s);
          return (
            <Link key={s.slotId} className="session" href={href({ slot: s.slotId })} aria-current={s.slotId === sel?.slotId ? 'true' : undefined}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(s.startsAt)}</span>
                {t ? <span className={`stag ${t.now ? 'now' : ''}`}>{t.text}</span> : null}
              </span>
              <span className="serif" style={{ fontSize: 17 }}>{s.activityName}</span>
              <span className="meta">{s.place} · {s.booked}/{s.capacity} booked · {s.arrived} here</span>
            </Link>
          );
        })}
        {sessions.length === 0 ? <p className="muted">No sessions on this day.</p> : null}
      </aside>

      {sel ? (
        <main className="staffmain">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <div className="stack" style={{ gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--moss)' }}>{day.short} · {fmtTime(sel.startsAt)} · {sel.place}</span>
              <h1 className="h1" style={{ fontSize: 34 }}>{sel.activityName}</h1>
            </div>
            <Link className="btn" style={{ minHeight: 50, background: 'var(--forest)', fontSize: 15 }} href={`/staff/walk-in?slot=${sel.slotId}`}>
              <Plus size={18} /> Add walk-in
            </Link>
          </div>
          <div className="stats">
            <div className="stack"><span>Capacity</span><span>{sel.capacity}</span></div>
            <div className="stack"><span>Booked</span><span>{sel.booked}</span></div>
            <div className="stack"><span>Checked in</span><span style={{ color: 'var(--moss)' }}>{sel.arrived}</span></div>
            <div className="stack"><span>Open spots</span><span style={{ color: 'var(--ochre)' }}>{Math.max(0, sel.capacity - sel.booked)}</span></div>
          </div>
          {note ? <div className="note" role="status" style={{ fontSize: 14 }}>{note}</div> : null}
          <Roster key={sel.slotId} rows={people} />
        </main>
      ) : null}
    </div>
  );
}
