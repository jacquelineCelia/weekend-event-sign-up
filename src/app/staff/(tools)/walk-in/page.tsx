import { activitiesForDay, seatOptions } from '@/lib/queries';
import { EVENT, dayText, fmtTimeL, requestTime } from '@/lib/event';
import { localText } from '@/lib/hans';
import { staffLang } from '@/lib/staff-lang';
import WalkInForm, { type WalkInActivity } from './WalkInForm';

export const dynamic = 'force-dynamic';

export default async function WalkIn({ searchParams }: { searchParams: Promise<{ slot?: string }> }) {
  const sp = await searchParams;
  const lang = await staffLang();
  const now = requestTime();
  const options: WalkInActivity[] = [];
  for (const d of EVENT.days) {
    for (const a of await activitiesForDay(d.date, lang)) {
      if (!a.slots.length) continue;
      // Leave out activities whose times have all ended.
      if (a.slots.every((s) => s.startsAt.getTime() + a.durationMin * 60000 <= now)) continue;
      const seats = (await seatOptions(a.id, a.slots.map((s) => s.id))).map((o) => ({ id: o.id, name: localText(o.name, o.nameZh, lang), left: o.left }));
      options.push({
        key: `${d.key}:${a.id}`,
        seats,
        label: `${dayText(d, 'short', lang)} · ${a.name}`,
        dayShort: dayText(d, 'short', lang),
        name: a.name,
        slots: a.slots.map((s) => {
          const mins = (s.startsAt.getTime() - now) / 60000;
          return { id: s.id, time: fmtTimeL(s.startsAt, lang), remaining: s.remaining, capacity: s.capacity, soon: mins > 0 && mins < 15, ended: mins < -a.durationMin };
        }),
      });
    }
  }
  const initial = options.find((o) => o.slots.some((s) => s.id === sp.slot));
  return (
    <div className="staffbody">
      <WalkInForm lang={lang} options={options} initialKey={initial?.key ?? options[0]?.key ?? ''} initialSlot={sp.slot ?? null} />
    </div>
  );
}
