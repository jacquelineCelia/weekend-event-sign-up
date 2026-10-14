import Link from 'next/link';
import { notFound } from 'next/navigation';
import { activityForDay, getBooking } from '@/lib/queries';
import { EVENT, addMinutes, dayByKey, dayOf, dayText, fmtDurationL, fmtTimeL, isLow, requestTime } from '@/lib/event';
import { getLang } from '@/lib/lang';
import { dict } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import { getPool } from '@/lib/db';
import { currentOwners } from '@/lib/viewer';
import { Back, Leaf } from '@/components/icons';
import SlotPicker, { type PickerSlot } from './SlotPicker';

export const dynamic = 'force-dynamic';

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string; slot?: string; change?: string }>;
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
  const lang = await getLang();
  const t = dict(lang);
  const a = await activityForDay(id, day.date, lang);
  if (!a) notFound();

  // "Change time" mode: moving an existing booking (only the owner's own).
  let change: { bookingId: string; partySize: number; currentSlotId: string } | null = null;
  if (sp.change) {
    const { ids } = await currentOwners();
    const b = await getBooking(sp.change);
    if (b?.personId && ids.includes(b.personId) && b.status === 'confirmed' && b.activityId === a.id) {
      change = { bookingId: b.id, partySize: b.partySize, currentSlotId: b.slotId };
    }
  }

  const now = requestTime();
  const slots: PickerSlot[] = a.slots.map((s) => {
    const past = s.startsAt.getTime() <= now;
    const current = change?.currentSlotId === s.id;
    return {
      id: s.id,
      range: `${fmtTimeL(s.startsAt, lang)} – ${fmtTimeL(addMinutes(s.startsAt, a.durationMin), lang)}`,
      short: fmtTimeL(s.startsAt, lang),
      remaining: past || current ? 0 : s.remaining,
      low: !past && !current && isLow(s.remaining, s.capacity),
      past,
      current,
      tooSmall: !!change && !current && s.remaining > 0 && s.remaining < change.partySize,
    };
  });
  const canPick = (s: PickerSlot) => s.remaining > 0 && !s.tooSmall;
  const firstOpen = slots.find(canPick)?.id ?? null;
  const preselected = change ? firstOpen : slots.find((s) => s.id === sp.slot && canPick(s))?.id ?? firstOpen;

  return (
    <div className="phone">
      <div className="topbar">
        {change ? (
          <span className="side"><Link className="back" href="/me"><Back /> <span className="lbl">{t.mySignups}</span></Link></span>
        ) : (
          <span className="side"><Link className="back" href={`/?day=${day.key}`}><Back /> <span className="lbl">{t.activities}</span></Link></span>
        )}
        <LangToggle lang={lang} />
        <span className="side end" />
      </div>
      <section className="pad stack" style={{ gap: 12, padding: '8px 20px 22px' }}>
        <span className="eyebrow"><Leaf /> {dayText(day, 'long', lang)}</span>
        <h1 className="h1" style={{ fontSize: 34 }}>{a.name}</h1>
        {a.description ? <p className="lede">{a.description}</p> : null}
        <div className="pills"><span>{a.place}</span><span>{fmtDurationL(a.durationMin, lang)}</span></div>
        {EVENT.days.length > 1 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            {t.alsoOn}{EVENT.days.filter((d) => d.key !== day.key).map((d) => (
              <Link key={d.key} href={`/activity/${a.id}?day=${d.key}${change ? `&change=${change.bookingId}` : ''}`}>{dayText(d, 'long', lang)}</Link>
            ))}
          </p>
        ) : null}
      </section>
      <SlotPicker lang={lang} slots={slots} preselected={preselected} change={change ? { bookingId: change.bookingId, partySize: change.partySize } : null} />
    </div>
  );
}
