import Link from 'next/link';
import { notFound } from 'next/navigation';
import { activityForDay, getBooking, seatOptions } from '@/lib/queries';
import { localText } from '@/lib/hans';
import { EVENT, addMinutes, dayByKey, dayOf, dayText, fmtDurationL, fmtTimeL, isLow, requestTime } from '@/lib/event';
import { getLang } from '@/lib/lang';
import { dict, zhBold } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import { getPool } from '@/lib/db';
import { currentOwners } from '@/lib/viewer';
import { Back, Leaf } from '@/components/icons';
import SlotPicker, { type PickerSlot, type PickerSeat } from './SlotPicker';

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
  let change: { bookingId: string; personId: string; partySize: number; currentSlotId: string; seats: { name: string; count: number }[] } | null = null;
  if (sp.change) {
    const { ids } = await currentOwners();
    const b = await getBooking(sp.change);
    if (b?.personId && ids.includes(b.personId) && b.status === 'confirmed' && b.activityId === a.id) {
      change = { bookingId: b.id, personId: b.personId, partySize: b.partySize, currentSlotId: b.slotId, seats: b.seats.map((x) => ({ name: x.name, count: x.count })) };
    }
  }

  const now = requestTime();
  // Seating choices (for activities that have them), with what's left of each type at each time.
  const seatOpts = await seatOptions(a.id, a.slots.map((s) => s.id));
  const seats: PickerSeat[] = seatOpts.map((o) => ({ id: o.id, name: localText(o.name, o.nameZh, lang), left: o.left }));
  // Moving a sign-up: the new time needs the same seats free.
  // Seat types without enough room at a time, to say why it can't be picked.
  const seatsShort = (slotId: string) =>
    (change?.seats ?? []).flatMap((x) => {
      const o = seatOpts.find((y) => y.name === x.name);
      const left = o?.left[slotId] ?? 0;
      return left < x.count ? [{ name: o ? localText(o.name, o.nameZh, lang) : x.name, left, need: x.count }] : [];
    });
  // Moving a sign-up: times that overlap the person's other sign-ups can't be picked (and say why).
  const others = change
    ? (await getPool().query<{ starts_at: Date; duration_min: number; name: string; name_zh: string }>(
        `select s.starts_at, a.duration_min, a.name, a.name_zh
           from bookings b join slots s on s.id = b.slot_id join activities a on a.id = s.activity_id
          where b.person_id = $1 and b.status = 'confirmed' and b.id <> $2`,
        [change.personId, change.bookingId],
      )).rows
    : [];
  const clashes = (start: Date) => {
    const end = addMinutes(start, a.durationMin).getTime();
    return others
      .filter((o) => o.starts_at.getTime() < end && start.getTime() < addMinutes(o.starts_at, o.duration_min).getTime())
      .map((o) => {
        const range = `${fmtTimeL(o.starts_at, lang)} – ${fmtTimeL(addMinutes(o.starts_at, o.duration_min), lang)}`;
        return lang === 'en' ? `${localText(o.name, o.name_zh, lang)} (${range})` : `${localText(o.name, o.name_zh, lang)}（${range}）`;
      });
  };
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
      seatsShort: change && !current && !past && s.remaining >= change.partySize && seatsShort(s.id).length ? t.seatsShort(seatsShort(s.id)) : undefined,
      clash: change && !current && !past && clashes(s.startsAt).length ? t.clashWith(clashes(s.startsAt)) : undefined,
    };
  });
  const canPick = (s: PickerSlot) => s.remaining > 0 && !s.tooSmall && !s.seatsShort && !s.clash;
  const firstOpen = slots.find(canPick)?.id ?? null;
  const preselected = change ? firstOpen : slots.find((s) => s.id === sp.slot && canPick(s))?.id ?? firstOpen;

  return (
    <div className="phone">
      <div className="topbar">
        {change ? (
          <Link className="back" href="/me"><Back /> {t.mySignups}</Link>
        ) : (
          <Link className="back" href={`/?day=${day.key}`}><Back /> {t.allActivities}</Link>
        )}
        <LangToggle lang={lang} />
      </div>
      <section className="pad stack" style={{ gap: 12, padding: '8px 20px 22px' }}>
        <span className="eyebrow"><Leaf /> {dayText(day, 'long', lang)}</span>
        <h1 className={`h1${zhBold(a.name)}`} style={{ fontSize: 34 }}>{a.name}</h1>
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
      <SlotPicker lang={lang} slots={slots} seats={seats} preselected={preselected} change={change ? { bookingId: change.bookingId, partySize: change.partySize } : null} />
    </div>
  );
}
