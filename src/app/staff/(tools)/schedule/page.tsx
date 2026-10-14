import Link from 'next/link';
import { activitiesWithCounts, scheduleFor } from '@/lib/staff';
import { EVENT, addMinutes, dayByKey, requestTime } from '@/lib/event';
import { Plus } from '@/components/icons';
import SlotEditor from './SlotEditor';
import ActivityForm from './ActivityForm';
import FilterList from '../FilterList';

export const dynamic = 'force-dynamic';

export default async function Schedule({ searchParams }: { searchParams: Promise<{ day?: string; a?: string; saved?: string; past?: string }> }) {
  const sp = await searchParams;
  const day = dayByKey(sp.day);
  const now = requestTime();
  const allActs = await activitiesWithCounts(day.date);
  // An activity is finished for this day once its last time that day has ended.
  // Activities with no times that day stay listed, so times can be added.
  const done = (a: (typeof allActs)[number]) => !!a.last_start && addMinutes(a.last_start, a.duration_min).getTime() <= now;
  const showPast = sp.past === '1';
  const finished = allActs.filter(done).length;
  const acts = showPast ? allActs : allActs.filter((a) => !done(a));
  const isNew = sp.a === 'new';
  const cur = isNew ? null : allActs.find((a) => a.id === sp.a) ?? acts[0] ?? null;
  const slots = cur ? await scheduleFor(cur.id, day.date) : [];
  const href = (q: { day?: string; a?: string; past?: boolean }) =>
    `/staff/schedule?day=${q.day ?? day.key}&a=${q.a ?? cur?.id ?? ''}${(q.past ?? showPast) ? '&past=1' : ''}`;

  return (
    <div className="staffbody">
      <aside className="staffside" aria-label="Activities" style={{ maxWidth: 360 }}>
        <h2 className="h2" style={{ fontSize: 18, color: 'var(--ink-2)' }}>Activities</h2>
        <FilterList label="Search activities" placeholder="Search activity or place" noun={['activity', 'activities']}
          items={acts.map((a) => ({
            key: a.id,
            search: `${a.name} ${a.name_zh} ${a.place} ${a.place_zh}`,
            node: (
          <Link className="session" href={href({ a: a.id })} aria-current={a.id === cur?.id ? 'true' : undefined} style={{ padding: '13px 18px', borderRadius: 18 }}>
            <span className="serif" style={{ fontSize: 16 }}>{a.name}</span>
            <span className="meta">
              {a.slots} {a.slots === 1 ? 'time' : 'times'} · {a.spots} spots on {day.label}
              {!a.name_zh || !a.place_zh || (a.description && !a.description_zh) ? (
                <span title="Some Chinese text is missing; Chinese readers see the English for those parts."
                  style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: 'var(--ochre-pale)', color: 'var(--ochre-dark)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span lang="zh-Hant-TW">中</span> missing
                </span>
              ) : null}
            </span>
          </Link>
            ),
          }))} />
        {acts.length === 0 && allActs.length > 0 ? <p className="muted" style={{ margin: 4 }}>All of {day.label}’s activities have finished.</p> : null}
        {finished > 0 ? (
          <Link href={href({ a: cur && !done(cur) ? cur.id : '', past: !showPast })} style={{ fontSize: 14, fontWeight: 600, color: 'var(--moss)', padding: '0 4px' }}>
            {showPast ? 'Hide finished activities' : `Show ${finished} finished ${finished === 1 ? 'activity' : 'activities'}`}
          </Link>
        ) : null}
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
              <ActivityForm activity={{ id: cur.id, name: cur.name, place: cur.place, durationMin: cur.duration_min, description: cur.description, nameZh: cur.name_zh, placeZh: cur.place_zh, descriptionZh: cur.description_zh }} />
            </details>
          </>
        ) : (
          <p className="muted">No activities yet.</p>
        )}
      </main>
    </div>
  );
}
