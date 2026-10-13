import Link from 'next/link';
import { activitiesWithCounts, scheduleFor } from '@/lib/staff';
import { EVENT, dayByKey } from '@/lib/event';
import { Plus } from '@/components/icons';
import SlotEditor from './SlotEditor';
import ActivityForm from './ActivityForm';

export const dynamic = 'force-dynamic';

export default async function Schedule({ searchParams }: { searchParams: Promise<{ day?: string; a?: string; saved?: string }> }) {
  const sp = await searchParams;
  const day = dayByKey(sp.day);
  const acts = await activitiesWithCounts(day.date);
  const isNew = sp.a === 'new';
  const cur = isNew ? null : acts.find((a) => a.id === sp.a) ?? acts[0] ?? null;
  const slots = cur ? await scheduleFor(cur.id, day.date) : [];
  const href = (q: { day?: string; a?: string }) => `/staff/schedule?day=${q.day ?? day.key}&a=${q.a ?? cur?.id ?? ''}`;

  return (
    <div className="staffbody">
      <aside className="staffside" aria-label="Activities" style={{ maxWidth: 360 }}>
        <h2 className="h2" style={{ fontSize: 18, color: 'var(--ink-2)' }}>Activities</h2>
        {acts.map((a) => (
          <Link key={a.id} className="session" href={href({ a: a.id })} aria-current={a.id === cur?.id ? 'true' : undefined} style={{ padding: '13px 18px', borderRadius: 18 }}>
            <span className="serif" style={{ fontSize: 16 }}>{a.name}</span>
            <span className="meta">{a.slots} {a.slots === 1 ? 'time' : 'times'} · {a.spots} spots on {day.label}</span>
          </Link>
        ))}
        <Link className="btn ghost" href={`/staff/schedule?day=${day.key}&a=new`} style={{ border: '1.5px dashed #8c9688', color: 'var(--moss-dark)' }} aria-current={isNew ? 'true' : undefined}>
          <Plus size={18} /> Add an activity
        </Link>
      </aside>

      <main className="staffmain" style={{ gap: 18 }}>
        {isNew ? (
          <>
            <h1 className="h1" style={{ fontSize: 34 }}>New activity</h1>
            <ActivityForm activity={null} />
          </>
        ) : cur ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14 }}>
              <div className="stack" style={{ gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--moss)' }}>{cur.place} · {cur.duration_min} min sessions</span>
                <h1 className="h1" style={{ fontSize: 34 }}>{cur.name}</h1>
              </div>
              <nav className="segment" aria-label="Day" style={{ minWidth: 280 }}>
                {EVENT.days.map((d) => (
                  <Link key={d.key} href={href({ day: d.key })} aria-current={d.key === day.key ? 'true' : undefined}>{d.label}</Link>
                ))}
              </nav>
            </div>
            <SlotEditor
              key={`${cur.id}-${day.key}-${slots.map((s) => `${s.id}${s.time}${s.capacity}${s.booked}`).join()}`}
              activityId={cur.id}
              day={day.date}
              dayName={day.long}
              durationMin={cur.duration_min}
              initial={slots}
              justSaved={sp.saved !== undefined && sp.a === cur.id ? Number(sp.saved) || 0 : null}
            />
            <details className="panel" style={{ gap: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 32 }}>Edit activity details</summary>
              <ActivityForm activity={{ id: cur.id, name: cur.name, place: cur.place, durationMin: cur.duration_min, description: cur.description }} />
            </details>
          </>
        ) : (
          <p className="muted">No activities yet.</p>
        )}
      </main>
    </div>
  );
}
