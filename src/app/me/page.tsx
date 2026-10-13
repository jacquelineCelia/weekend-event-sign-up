import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPool } from '@/lib/db';
import { getPerson } from '@/lib/queries';
import { currentPersonId } from '@/lib/session';
import { EVENT, addMinutes, dayOf, fmtTime, requestTime } from '@/lib/event';
import { Back, Bell, Plus } from '@/components/icons';
import { signOutAction } from './actions';
import { CancelButton, RatePicker } from './widgets';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; code: string; party_size: number; starts_at: Date; duration_min: number; remind_sms: boolean; remind_email: boolean;
  activity_name: string; place: string; activity_id: string; slot_id: string; score: number | null;
};

const spots = (n: number) => `${n} ${n === 1 ? 'spot' : 'spots'}`;

export default async function MySignups({ searchParams }: { searchParams: Promise<{ moved?: string }> }) {
  const me = await currentPersonId();
  const person = me ? await getPerson(me) : null;
  if (!person) redirect('/me/sign-in');
  const sp = await searchParams;

  const { rows } = await getPool().query<Row>(
    `select b.id, b.code, b.party_size, s.starts_at, a.duration_min, b.remind_sms, b.remind_email,
            a.name as activity_name, a.place, a.id as activity_id, s.id as slot_id, r.score
       from bookings b join slots s on s.id = b.slot_id join activities a on a.id = s.activity_id
       left join ratings r on r.booking_id = b.id
      where b.person_id = $1 and b.status = 'confirmed'
      order by s.starts_at`,
    [person.id],
  );
  const now = requestTime();
  const next = rows.find((r) => r.starts_at.getTime() > now);
  const byDay = EVENT.days.map((d) => ({ d, items: rows.filter((r) => dayOf(r.starts_at)?.key === d.key) })).filter((g) => g.items.length);
  const minsUntil = next ? Math.round((next.starts_at.getTime() - now) / 60000) : 0;
  const upNextLabel = minsUntil < 60 ? `in ${minsUntil} min` : minsUntil < 24 * 60 ? `in ${Math.round(minsUntil / 60)} hr` : `${dayOf(next!.starts_at)?.short}`;

  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href="/"><Back /> Activities</Link>
        <form action={signOutAction}>
          <button type="submit" className="back" style={{ border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 500, color: 'var(--muted)', fontSize: 13 }}>
            {person.name} · Sign out
          </button>
        </form>
      </div>
      <section className="pad stack" style={{ gap: 6, padding: '8px 20px 18px' }}>
        <h1 className="h1" style={{ fontSize: 31 }}>Your weekend</h1>
        <p className="muted" style={{ margin: 0 }}>{rows.length} {rows.length === 1 ? 'activity' : 'activities'}</p>
        {sp.moved ? <p className="note ok" role="status" style={{ margin: '8px 0 0' }}>Time changed. Your code stays the same.</p> : null}
      </section>

      {next ? (
        <section aria-label="Up next" className="summary" style={{ margin: '0 20px 22px', flexDirection: 'column', alignItems: 'stretch', gap: 12, borderRadius: 24, padding: '20px 20px 18px' }}>
          <svg viewBox="0 0 350 70" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 0, width: '100%', height: 70, opacity: 0.55 }}>
            <path d="M0 50 C 80 30, 160 36, 230 48 S 320 52, 350 40 L350 70 L0 70 Z" fill="#3B5644" />
            <path d="M0 62 C 100 50, 220 60, 350 54 L350 70 L0 70 Z" fill="#4E6E57" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#cfdacb' }}>Up next · {upNextLabel}</span>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.14em', background: 'var(--paper)', color: 'var(--ink)', padding: '4px 10px', borderRadius: 999 }}>{next.code}</span>
          </div>
          <div className="stack" style={{ gap: 4, position: 'relative' }}>
            <span className="serif" style={{ fontSize: 24 }}>{next.activity_name}</span>
            <span className="sub">{fmtTime(next.starts_at)} · {next.place} · {spots(next.party_size)}</span>
          </div>
          {next.remind_sms || next.remind_email ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: 'var(--on-dark-2)', position: 'relative' }}>
              <Bell size={16} /> Reminder at {fmtTime(addMinutes(next.starts_at, -15))}
            </div>
          ) : null}
        </section>
      ) : null}

      {byDay.map(({ d, items }) => (
        <section key={d.key} className="pad stack" style={{ gap: 10, paddingBottom: 20 }}>
          <h2 className="h2" style={{ fontSize: 18, color: 'var(--ink-2)' }}>{d.long}</h2>
          {items.map((r) => {
            const started = r.starts_at.getTime() <= now;
            const done = addMinutes(r.starts_at, r.duration_min).getTime() <= now;
            return (
              <article key={r.id} className="card" style={{ borderRadius: 20, padding: 16, gap: 12, background: started ? 'var(--stone)' : undefined }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ width: 74, flex: 'none', fontWeight: 700, color: 'var(--moss)', fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{fmtTime(r.starts_at)}</div>
                  <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                    <span className="serif" style={{ fontSize: 17, color: started ? 'var(--muted-2)' : undefined }}>{r.activity_name}</span>
                    <span className="muted" style={{ fontSize: 13.5 }}>{r.place} · {spots(r.party_size)} · code {r.code}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4, color: started ? 'var(--muted-2)' : 'var(--moss-dark)' }}>
                      {done ? 'Done' : started ? 'Happening now' : r.id === next?.id ? 'Up next' : r.remind_sms || r.remind_email ? 'Reminder 15 min before' : 'No reminder'}
                    </span>
                  </div>
                </div>
                {!started ? (
                  <div style={{ display: 'flex', gap: 8, paddingLeft: 88, flexWrap: 'wrap' }}>
                    <Link className="btn ghost" style={{ minHeight: 42, fontSize: 14, padding: '0 14px' }} href={`/activity/${r.activity_id}?slot=${r.slot_id}&change=${r.id}`}>Change time</Link>
                    <CancelButton bookingId={r.id} />
                  </div>
                ) : done ? (
                  <RatePicker bookingId={r.id} name={r.activity_name} score={r.score} />
                ) : null}
              </article>
            );
          })}
        </section>
      ))}

      {rows.length === 0 ? <p className="empty">No sign-ups yet.</p> : null}

      <div className="pad" style={{ paddingBottom: 30 }}>
        <Link className="btn ghost" href="/" style={{ width: '100%', border: '1.5px dashed #8c9688', color: 'var(--moss-dark)' }}>
          <Plus size={18} /> Add another activity
        </Link>
      </div>
    </div>
  );
}
