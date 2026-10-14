import { activitiesForDay } from '@/lib/queries';
import { EVENT, fmtTime, requestTime } from '@/lib/event';
import WalkInForm, { type WalkInActivity } from './WalkInForm';

export const dynamic = 'force-dynamic';

export default async function WalkIn({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const sp = await searchParams;
  const now = requestTime();
  const options: WalkInActivity[] = [];
  for (const d of EVENT.days) {
    for (const a of await activitiesForDay(d.date)) {
      if (!a.slots.length) continue;
      // Leave out activities whose times have all ended.
      if (a.slots.every((s) => s.startsAt.getTime() + a.durationMin * 60000 <= now)) continue;
      options.push({
        key: `${d.key}:${a.id}`,
        label: `${d.short} · ${a.name}`,
        dayShort: d.short,
        name: a.name,
        slots: a.slots.map((s) => {
          const mins = (s.startsAt.getTime() - now) / 60000;
          return { id: s.id, time: fmtTime(s.startsAt), remaining: s.remaining, capacity: s.capacity, soon: mins > 0 && mins < 15, ended: mins < -a.durationMin };
        }),
      });
    }
  }
  const initial = options.find((o) => o.slots.some((s) => s.id === sp.slot));
  return (
    <div className="staffbody">
      <WalkInForm options={options} initialKey={initial?.key ?? options[0]?.key ?? ''} initialSlot={sp.slot ?? null} />
    </div>
  );
}
