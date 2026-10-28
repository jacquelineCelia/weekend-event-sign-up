import Link from 'next/link';
import { registrationAt, startTimes } from '@/lib/staff';
import { EVENT, addMinutes, dayOf, fmtTime, requestTime } from '@/lib/event';
import AutoRefresh from '../AutoRefresh';

export const dynamic = 'force-dynamic';

const pct = (n: number, of: number) => (of > 0 ? Math.min(100, Math.round((n / of) * 100)) : 0);

/**
 * Registration by time: pick a start time on the left, see every activity running then with how full
 * it is (booked, on hold, open, checked in, seating). Times are keyed by their start (?t=ISO).
 */
export default async function Registration({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const sp = await searchParams;
  const now = requestTime();
  const times = await startTimes();
  // Default: the time that's on now or next; after the event, the last one.
  const chosen =
    times.find((x) => x.startsAt.toISOString() === sp.t) ??
    [...times].reverse().find((x) => x.startsAt.getTime() <= now && x.endsAt.getTime() > now) ??
    times.find((x) => x.startsAt.getTime() > now) ??
    times[times.length - 1];
  const rows = chosen ? await registrationAt(chosen.startsAt) : [];

  const total = rows.reduce(
    (t, r) => ({ capacity: t.capacity + r.capacity, booked: t.booked + r.booked, held: t.held + r.held, arrived: t.arrived + r.arrived }),
    { capacity: 0, booked: 0, held: 0, arrived: 0 },
  );
  const longest = Math.max(0, ...rows.map((r) => r.durationMin));
  // The Check-in screen lists one day at a time and hides finished sessions unless asked.
  const rosterHref = (slotId: string, durationMin: number) => {
    const d = chosen ? dayOf(chosen.startsAt) : null;
    const finished = chosen ? addMinutes(chosen.startsAt, durationMin).getTime() <= now : false;
    return `/staff?${d ? `day=${d.key}&` : ''}slot=${slotId}${finished ? '&past=1' : ''}`;
  };
  const byDay = EVENT.days
    .map((d) => ({ d, items: times.filter((x) => dayOf(x.startsAt)?.key === d.key) }))
    .filter((g) => g.items.length);
  const other = times.filter((x) => !dayOf(x.startsAt)); // times outside the event days, if any

  const timeLink = (x: (typeof times)[number]) => {
    const started = x.startsAt.getTime() <= now;
    const done = x.endsAt.getTime() <= now;
    return (
      <Link key={x.startsAt.toISOString()} className="session" href={`/staff/registration?t=${encodeURIComponent(x.startsAt.toISOString())}`}
        aria-current={chosen && x.startsAt.getTime() === chosen.startsAt.getTime() ? 'true' : undefined}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(x.startsAt)}</span>
          {done ? <span className="stag">Done</span> : started ? <span className="stag now">In progress</span> : null}
        </span>
        <span className="meta">
          {x.activities} {x.activities === 1 ? 'activity' : 'activities'} · {x.booked}/{x.capacity} booked
        </span>
      </Link>
    );
  };

  return (
    <div className="staffbody">
      <AutoRefresh seconds={20} />
      <aside className="staffside scrollside" aria-label="Time slots">
        <h2 className="h2" style={{ fontSize: 18, color: 'var(--ink-2)' }}>Time slots</h2>
        {byDay.map(({ d, items }) => (
          <section key={d.key} className="stack" style={{ gap: 8 }} aria-label={d.long}>
            <h3 style={{ margin: '6px 4px 0', fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>{d.long}</h3>
            {items.map(timeLink)}
          </section>
        ))}
        {other.length ? (
          <section className="stack" style={{ gap: 8 }} aria-label="Other days">
            <h3 style={{ margin: '6px 4px 0', fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>Other days</h3>
            {other.map(timeLink)}
          </section>
        ) : null}
        {times.length === 0 ? <p className="muted">No time slots yet. Add them on the Schedule &amp; capacity screen.</p> : null}
      </aside>

      {chosen ? (
        <main className="staffmain">
          <div className="stack" style={{ gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--moss)' }}>
              {dayOf(chosen.startsAt)?.long ?? chosen.startsAt.toDateString()}
            </span>
            <h1 className="h1" style={{ fontSize: 34 }}>
              {fmtTime(chosen.startsAt)}{longest ? ` – ${fmtTime(addMinutes(chosen.startsAt, longest))}` : ''}
            </h1>
          </div>
          <div className="stats">
            <div className="stack"><span>Capacity</span><span>{total.capacity}</span></div>
            <div className="stack"><span>Booked</span><span>{total.booked}</span></div>
            <div className="stack"><span>Open</span><span style={{ color: 'var(--ochre)' }}>{Math.max(0, total.capacity - total.booked - total.held)}</span></div>
            <div className="stack"><span>Checked in</span><span style={{ color: 'var(--moss)' }}>{total.arrived}</span></div>
          </div>

          <section className="roster" aria-label="Activities at this time">
            {rows.map((r) => {
              const open = Math.max(0, r.capacity - r.booked - r.held);
              const full = r.booked + r.held >= r.capacity;
              return (
                <div key={r.slotId} className="rrow" style={{ alignItems: 'flex-start' }}>
                  <div className="stack" style={{ gap: 6, flex: '1 1 260px', minWidth: 0 }}>
                    <span className="serif" style={{ fontSize: 18 }}>{r.activityName}</span>
                    <span className="muted" style={{ fontSize: 13.5 }}>
                      {r.place} · {r.parties} {r.parties === 1 ? 'party' : 'parties'}
                      {r.walkIns ? ` (${r.walkIns} walk-in${r.walkIns === 1 ? '' : 's'})` : ''}
                    </span>
                    <div aria-hidden="true" style={{ height: 8, borderRadius: 999, background: 'var(--ground-2)', overflow: 'hidden', display: 'flex' }}>
                      <span style={{ width: `${pct(r.booked, r.capacity)}%`, background: full ? 'var(--ochre)' : 'var(--moss)' }} />
                      <span style={{ width: `${pct(r.held, r.capacity)}%`, background: 'var(--sage)' }} />
                    </div>
                    {r.seats.length ? (
                      <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
                        Seating: {r.seats.map((x) => `${x.name} ${x.booked}/${x.capacity}`).join(' · ')}
                      </span>
                    ) : null}
                  </div>
                  <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 64px)', gap: '2px 18px', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {[
                      ['Booked', `${r.booked}/${r.capacity}`, full ? 'var(--ochre)' : 'var(--ink)'],
                      ['On hold', String(r.held), 'var(--muted)'],
                      ['Open', full ? 'Full' : String(open), full ? 'var(--ochre)' : 'var(--moss-dark)'],
                      ['Here', String(r.arrived), 'var(--moss)'],
                    ].map(([k, v, c]) => (
                      <div key={k} className="stack" style={{ gap: 2 }}>
                        <dt style={{ fontSize: 12, color: 'var(--muted)' }}>{k}</dt>
                        <dd style={{ margin: 0, fontSize: 18, fontWeight: 600, color: c }}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <Link href={rosterHref(r.slotId, r.durationMin)} className="btn ghost" style={{ minHeight: 40, fontSize: 14, padding: '0 14px', alignSelf: 'center' }}>
                    Roster
                  </Link>
                </div>
              );
            })}
          </section>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            “On hold” is people still filling in their details (held for 10 minutes). Updates every 20 seconds.
          </p>
        </main>
      ) : null}
    </div>
  );
}
