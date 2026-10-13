import Link from 'next/link';
import { notFound } from 'next/navigation';
import { activityForDay } from '@/lib/queries';
import { EVENT, addMinutes, dayByKey, dayOf, fmtDuration, fmtTime, isLow, requestTime } from '@/lib/event';
import { getPool } from '@/lib/db';
import { Back, Leaf } from '@/components/icons';
import SlotPicker, { type PickerSlot } from './SlotPicker';

export const dynamic = 'force-dynamic';

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string; slot?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // A slot link carries its own day; otherwise use ?day=.
  let day = dayByKey(sp.day);
  if (sp.slot && /^[0-9a-f-]{36}$/i.test(sp.slot)) {
    const r = await getPool().query<{ starts_at: Date }>('select starts_at from slots where id = $1', [sp.slot]);
    const d = r.rows[0] && dayOf(r.rows[0].starts_at);
    if (d) day = d;
  }
  const a = await activityForDay(id, day.date);
  if (!a) notFound();

  const now = requestTime();
  const slots: PickerSlot[] = a.slots.map((s) => {
    const past = s.startsAt.getTime() <= now;
    return {
      id: s.id,
      range: `${fmtTime(s.startsAt)} – ${fmtTime(addMinutes(s.startsAt, a.durationMin))}`,
      short: fmtTime(s.startsAt),
      remaining: past ? 0 : s.remaining,
      low: !past && isLow(s.remaining, s.capacity),
      past,
    };
  });
  const firstOpen = slots.find((s) => s.remaining > 0)?.id ?? null;
  const preselected = slots.find((s) => s.id === sp.slot && s.remaining > 0)?.id ?? firstOpen;

  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href={`/?day=${day.key}`}><Back /> All activities</Link>
      </div>
      <section className="pad stack" style={{ gap: 12, padding: '8px 20px 22px' }}>
        <span className="eyebrow"><Leaf /> {day.long}</span>
        <h1 className="h1" style={{ fontSize: 34 }}>{a.name}</h1>
        {a.description ? <p className="lede">{a.description}</p> : null}
        <div className="pills"><span>{a.place}</span><span>{fmtDuration(a.durationMin)}</span></div>
        {EVENT.days.length > 1 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            Also on {EVENT.days.filter((d) => d.key !== day.key).map((d) => (
              <Link key={d.key} href={`/activity/${a.id}?day=${d.key}`}>{d.long}</Link>
            ))}
          </p>
        ) : null}
      </section>
      <SlotPicker slots={slots} preselected={preselected} />
    </div>
  );
}
