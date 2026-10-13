import Link from 'next/link';
import { activitiesForDay } from '@/lib/queries';
import { EVENT, dayByKey, fmtDuration, fmtTime, isLow, requestTime } from '@/lib/event';
import { Calendar, Hills, Leaf, Check } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function Browse({ searchParams }: { searchParams: Promise<{ day?: string; open?: string }> }) {
  const sp = await searchParams;
  const day = dayByKey(sp.day);
  const onlyOpen = sp.open === '1';
  const all = await activitiesForDay(day.date);
  const now = requestTime();

  const acts = all
    .map((a) => {
      const upcoming = a.slots.filter((s) => s.startsAt.getTime() > now);
      return { ...a, open: upcoming.filter((s) => s.remaining > 0), hasSlots: a.slots.length > 0 };
    })
    .filter((a) => a.hasSlots)
    .filter((a) => !onlyOpen || a.open.length > 0);

  const href = (q: { day?: string; open?: boolean }) => {
    const p = new URLSearchParams();
    p.set('day', q.day ?? day.key);
    if (q.open ?? onlyOpen) p.set('open', '1');
    return `/?${p}`;
  };
  const total = all.filter((a) => a.slots.length > 0).length;

  return (
    <div className="phone">
      <header className="hero">
        <div className="meta">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Leaf /> {EVENT.dateRange}</span>
          <Link href="/me"><Calendar /> My sign-ups</Link>
        </div>
        <h1>{EVENT.name}<br />Activities</h1>
        <p>Gentle ways to spend the weekend. Choose a time that suits you — we&apos;ll send a reminder 15 minutes before.</p>
        <Hills />
      </header>

      <div className="filterbar">
        <nav className="segment" aria-label="Day">
          {EVENT.days.map((d) => (
            <Link key={d.key} href={href({ day: d.key })} aria-current={d.key === day.key ? 'true' : undefined}>{d.label}</Link>
          ))}
        </nav>
        <div className="filterrow">
          <Link className="toggle-link" href={href({ open: !onlyOpen })} role="switch" aria-checked={onlyOpen}>
            <span className="box" data-on={onlyOpen}>{onlyOpen ? <Check /> : null}</span>
            Has open spots
          </Link>
          <span className="muted" aria-live="polite" style={{ fontSize: 13 }}>
            {acts.length === total ? `${total} activities` : `${acts.length} of ${total} activities`}
          </span>
        </div>
      </div>

      <main className="list" aria-label="Activities">
        {acts.map((a) => (
          <section key={a.id} className="card" aria-labelledby={`a-${a.id}`}>
            <div className="card-head">
              <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                <Link id={`a-${a.id}`} className="card-title" href={`/activity/${a.id}?day=${day.key}`}>{a.name}</Link>
                <span className="card-sub">{a.place} · {fmtDuration(a.durationMin)}</span>
              </div>
              {a.open.length === 0 ? <span className="badge">Fully booked</span> : null}
            </div>
            {a.open.length > 0 ? (
              <div className="chips">
                {a.open.map((s) => {
                  const low = isLow(s.remaining, s.capacity);
                  return (
                    <Link key={s.id} className={`chip ${low ? 'low' : 'open'}`} href={`/activity/${a.id}?day=${day.key}&slot=${s.id}`}
                      aria-label={`${a.name} at ${fmtTime(s.startsAt)}, ${s.remaining} spots left`}>
                      <b>{fmtTime(s.startsAt)}</b>
                      <span>{low ? `Only ${s.remaining} left` : `${s.remaining} left`}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        ))}
        {acts.length === 0 ? <p className="empty">Everything on this day is full. Try the other day.</p> : null}
      </main>
    </div>
  );
}
