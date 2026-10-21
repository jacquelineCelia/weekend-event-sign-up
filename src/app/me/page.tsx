import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPool } from '@/lib/db';
import { currentOwners } from '@/lib/viewer';
import { EVENT, addMinutes, dayOf, dayText, fmtTimeL, isChinese, requestTime } from '@/lib/event';
import { localText, seatLine } from '@/lib/hans';
import { seatOptions, seatsForBookings } from '@/lib/queries';
import { getLang } from '@/lib/lang';
import { dict, zhBold } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import { Back, Bell, Plus } from '@/components/icons';
import VenueMap, { type MapPlace } from '@/components/VenueMap';
import { LegalFoot } from '@/components/LegalPage';
import { signOutAction } from './actions';
import { CancelButton, RatePicker, SeatChanger, type SeatChoice } from './widgets';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; code: string; party_size: number; starts_at: Date; duration_min: number; remind_sms: boolean; remind_email: boolean;
  activity_name: string; place: string; place_en?: string; name_zh: string; place_zh: string; activity_id: string; slot_id: string; score: number | null; person_name: string;
};

export default async function MySignups({ searchParams }: { searchParams: Promise<{ moved?: string; seated?: string }> }) {
  const { viewer, ids } = await currentOwners();
  if (!viewer || !ids.length) redirect('/me/sign-in');
  const sp = await searchParams;
  const lang = await getLang();
  const t = dict(lang);
  const names = (await getPool().query<{ name: string }>('select name from people where id = any($1::uuid[]) order by created_at', [ids])).rows.map((r) => r.name);

  const { rows } = await getPool().query<Row>(
    `select b.id, b.code, b.party_size, s.starts_at, a.duration_min, b.remind_sms, b.remind_email,
            a.name as activity_name, a.name_zh,
            a.place, a.place_zh, a.id as activity_id, s.id as slot_id, r.score, p.name as person_name
       from bookings b join slots s on s.id = b.slot_id join activities a on a.id = s.activity_id
       join people p on p.id = b.person_id
       left join ratings r on r.booking_id = b.id
      where b.person_id = any($1::uuid[]) and b.status = 'confirmed'
      order by s.starts_at, p.created_at`,
    [ids],
  );
  // How each party is seated, for activities with seating choices ("High chair × 1 · Ground seat × 2").
  const seatMap = await seatsForBookings(rows.map((r) => r.id));
  const seatsOf = (id: string) => seatLine(seatMap.get(id) ?? [], lang);
  // For "Change seating" on upcoming sign-ups at activities with seating: what's free at that time,
  // counting the sign-up's own seats as free.
  const seatChoices = new Map<string, SeatChoice[]>();
  for (const r of rows) {
    if (r.starts_at.getTime() <= requestTime()) continue;
    const opts = await seatOptions(r.activity_id, [r.slot_id]);
    if (!opts.length) continue;
    const mine = seatMap.get(r.id) ?? [];
    seatChoices.set(r.id, opts.map((o) => {
      const count = mine.find((m) => m.seatTypeId === o.id)?.count ?? 0;
      return { id: o.id, name: localText(o.name, o.nameZh, lang), free: (o.left[r.slot_id] ?? 0) + count, count };
    }));
  }
  for (const r of rows) {
    r.activity_name = localText(r.activity_name, r.name_zh, lang);
    r.place_en = r.place;
    r.place = localText(r.place, r.place_zh, lang);
  }
  const now = requestTime();
  // Every place on the grounds with what happens there, for the map in the Up next card.
  const placeRows = (await getPool().query<{ name: string; name_zh: string; place: string; place_zh: string }>(
    'select name, name_zh, place, place_zh from activities order by sort_order, name',
  )).rows;
  const mapPlaces: MapPlace[] = [];
  for (const a of placeRows) {
    let p = mapPlaces.find((m) => m.key === a.place);
    if (!p) mapPlaces.push(p = { key: a.place, label: localText(a.place, a.place_zh, lang), activities: [] });
    p.activities.push(localText(a.name, a.name_zh, lang));
  }
  const next = rows.find((r) => r.starts_at.getTime() > now);
  const byDay = EVENT.days.map((d) => ({ d, items: rows.filter((r) => dayOf(r.starts_at)?.key === d.key) })).filter((g) => g.items.length);
  const minsUntil = next ? Math.round((next.starts_at.getTime() - now) / 60000) : 0;
  // Signed in with a phone several people share: label each activity with whose it is.
  const household = new Set(rows.map((r) => r.person_name)).size > 1 || (viewer.kind === 'phone' && names.length > 1);
  const who = viewer.kind === 'phone' ? (names.length > 1 ? t.peopleOn(names.length, viewer.phone.slice(-4)) : names[0]) : names[0];
  const nextDay = next ? dayOf(next.starts_at) : null;
  // Next activity's row: "Up next · Reminder at 12:45 PM" (or "· No reminder"; just "Up next" once the reminder time has passed).
  const upNextStatus = (r: Row) => {
    if (!(r.remind_sms || r.remind_email)) return `${t.upNext} · ${t.noReminderShort}`;
    const at = addMinutes(r.starts_at, -15);
    return at.getTime() > now ? `${t.upNext} · ${t.reminderAt(fmtTimeL(at, lang))}` : t.upNext;
  };
  const upNextLabel = minsUntil < 60 ? t.inMin(minsUntil) : minsUntil < 24 * 60 ? t.inHr(Math.round(minsUntil / 60)) : nextDay ? dayText(nextDay, 'short', lang) : '';

  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href="/"><Back /> {t.allActivities}</Link>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <LangToggle lang={lang} />
        <form action={signOutAction}>
          <button type="submit" className="back" style={{ border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 500, color: 'var(--muted)', fontSize: 13 }}>
            {who} · {t.signOut}
          </button>
        </form>
        </span>
      </div>
      <section className="pad stack" style={{ gap: 6, padding: '8px 20px 18px' }}>
        <h1 className="h1" style={{ fontSize: 31 }}>{t.yourWeekend}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t.nActivities(rows.length)}{household ? ` · ${names.join(isChinese(lang) ? '、' : ', ')}` : ''}
        </p>
        {sp.moved ? <p className="note ok" role="status" style={{ margin: '8px 0 0' }}>{t.moved}</p> : null}
        {sp.seated ? <p className="note ok" role="status" style={{ margin: '8px 0 0' }}>{t.seatingChanged}</p> : null}
      </section>

      {next ? (
        <section aria-label={t.upNext} className="summary" style={{ margin: '0 20px 22px', flexDirection: 'column', alignItems: 'stretch', gap: 12, borderRadius: 24, padding: '20px 20px 18px' }}>
          <svg viewBox="0 0 350 70" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 0, width: '100%', height: 70, opacity: 0.55 }}>
            <path d="M0 50 C 80 30, 160 36, 230 48 S 320 52, 350 40 L350 70 L0 70 Z" fill="#3B5644" />
            <path d="M0 62 C 100 50, 220 60, 350 54 L350 70 L0 70 Z" fill="#4E6E57" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#cfdacb' }}>{t.upNext} · {upNextLabel}</span>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.14em', background: 'var(--paper)', color: 'var(--ink)', padding: '4px 10px', borderRadius: 999 }}>{next.code}</span>
          </div>
          <div className="stack" style={{ gap: 4, position: 'relative' }}>
            <span className={`serif${zhBold(next.activity_name)}`} style={{ fontSize: 24 }}>{next.activity_name}</span>
            <span className="sub">{fmtTimeL(next.starts_at, lang)} · {next.place} · {t.spots(next.party_size)}{household ? ` · ${next.person_name}` : ''}</span>
            {seatsOf(next.id) ? <span className="sub">{t.seatingIs(seatsOf(next.id))}</span> : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, position: 'relative' }}>
            {next.remind_sms || next.remind_email ? (
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: 'var(--on-dark-2)' }}>
                <Bell size={16} /> {t.reminderAt(fmtTimeL(addMinutes(next.starts_at, -15), lang))}
              </span>
            ) : <span />}
            <VenueMap places={mapPlaces} current={next.place_en ?? next.place} zh={isChinese(lang)}
              text={{ map: t.map, mapTitle: t.mapTitle, close: t.close, yourNext: t.yourNextHere, entrance: t.entrance }} />
          </div>
        </section>
      ) : null}

      {byDay.map(({ d, items }) => (
        <section key={d.key} className="pad stack" style={{ gap: 10, paddingBottom: 20 }}>
          <h2 className="h2" style={{ fontSize: 18, color: 'var(--ink-2)' }}>{dayText(d, 'long', lang)}</h2>
          {items.map((r) => {
            const started = r.starts_at.getTime() <= now;
            const done = addMinutes(r.starts_at, r.duration_min).getTime() <= now;
            return (
              <article key={r.id} className="card" style={{ borderRadius: 20, padding: 16, gap: 12, background: started ? 'var(--stone)' : undefined }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ width: 88, flex: 'none', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--moss)', fontVariantNumeric: 'tabular-nums', paddingTop: 2 }}>{fmtTimeL(r.starts_at, lang)}</div>
                  <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                    <span className={`serif${zhBold(r.activity_name)}`} style={{ fontSize: 17, color: started ? 'var(--muted-2)' : undefined }}>{r.activity_name}</span>
                    {household ? <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ochre)' }}>{r.person_name}</span> : null}
                    <span className="muted" style={{ fontSize: 13.5 }}>{r.place} · {t.spots(r.party_size)} · {t.code(r.code)}</span>
                    {seatsOf(r.id) ? <span style={{ fontSize: 13.5, color: started ? 'var(--muted-2)' : 'var(--ink-2)' }}>{t.seatingIs(seatsOf(r.id))}</span> : null}
                    <span style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4, color: started ? 'var(--muted-2)' : 'var(--moss-dark)' }}>
                      {done ? t.done : started ? t.happening
                        : r.id === next?.id ? upNextStatus(r)
                        : r.remind_sms || r.remind_email ? t.reminder15 : t.noReminderShort}
                    </span>
                  </div>
                </div>
                {!started ? (
                  <div style={{ display: 'flex', gap: 8, paddingLeft: 102, flexWrap: 'wrap' }}>
                    <Link className="btn ghost" style={{ minHeight: 42, fontSize: 14, padding: '0 14px' }} href={`/activity/${r.activity_id}?slot=${r.slot_id}&change=${r.id}`}>{t.changeTime}</Link>
                    {seatChoices.has(r.id) ? <SeatChanger lang={lang} bookingId={r.id} party={r.party_size} choices={seatChoices.get(r.id)!} /> : null}
                    <CancelButton lang={lang} bookingId={r.id} />
                  </div>
                ) : done ? (
                  <RatePicker lang={lang} bookingId={r.id} name={r.activity_name} score={r.score} />
                ) : null}
              </article>
            );
          })}
        </section>
      ))}

      {rows.length === 0 ? <p className="empty">{t.noSignups}</p> : null}

      <div className="pad" style={{ paddingBottom: 30 }}>
        <Link className="btn ghost" href="/" style={{ width: '100%', border: '1.5px dashed #8c9688', color: 'var(--moss-dark)' }}>
          <Plus size={18} /> {t.addAnother}
        </Link>
      </div>
      <LegalFoot lang={lang} />
    </div>
  );
}
