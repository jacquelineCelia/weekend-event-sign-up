import Link from 'next/link';
import { notFound } from 'next/navigation';
import { bookingText, getBooking } from '@/lib/queries';
import { seatLine } from '@/lib/hans';
import { addMinutes, dayOf, dayText, fmtTimeL } from '@/lib/event';
import { getLang } from '@/lib/lang';
import { dict, firstName, zhBold } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import { currentOwners } from '@/lib/viewer';
import { Bell, Sprout } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function Booked({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBooking(id);
  const { ids } = await currentOwners();
  // Only the person who booked can see the ticket (it holds their code).
  if (!b || b.status !== 'confirmed' || !b.personId || !ids.includes(b.personId)) notFound();

  const lang = await getLang();
  const t = dict(lang);
  const { activity, place } = bookingText(b, lang);
  const day = dayOf(b.startsAt);
  const how = b.remindSms && b.remindEmail ? 'both' : b.remindSms ? 'sms' : b.remindEmail ? 'email' : null;
  const first = firstName(b.personName);

  return (
    <div className="phone">
      <div className="topbar" style={{ justifyContent: 'flex-end' }}><LangToggle lang={lang} /></div>
      <div className="pad stack" style={{ gap: 24, padding: '12px 20px 28px' }}>
        <div className="stack" style={{ gap: 14, alignItems: 'flex-start' }}>
          <span className="leafmark"><Sprout /></span>
          <h1 className="h1" style={{ fontSize: 34 }}>{t.youreIn(first)}</h1>
          <p className="lede">
            {t.allSet}{b.personEmail ? t.confirmationTo(b.personEmail) : ''}
          </p>
        </div>

        <article className="ticket">
          <div className="top">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--moss)' }}>{day ? dayText(day, 'long', lang) : ''}</span>
            <span className={`serif${zhBold(activity)}`} style={{ fontSize: 24 }}>{activity}</span>
            <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>
              {fmtTimeL(b.startsAt, lang)} – {fmtTimeL(addMinutes(b.startsAt, b.durationMin), lang)} · {place}
            </span>
          </div>
          <div className="mid">
            <div className="stack" style={{ gap: 2 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{t.party}</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{t.spots(b.partySize)}</span>
              {b.seats.length ? <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{seatLine(b.seats, lang)}</span> : null}
            </div>
            <div className="stack" style={{ gap: 2 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{t.checkInCode}</span>
              <span className="code">{b.code}</span>
            </div>
          </div>
          <div className="bottom">
            <Bell />
            <span>
              {how ? t.remindWill(how, fmtTimeL(addMinutes(b.startsAt, -15), lang)) : t.noReminderChosen}
            </span>
          </div>
        </article>

        <div className="stack" style={{ gap: 10 }}>
          <Link className="btn" href="/">{t.another}</Link>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Link className="btn ghost" href="/me">{t.mySignups}</Link>
            <a className="btn ghost" href={`/booked/${b.id}/calendar`} download>{t.addToCalendar}</a>
          </div>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
          {t.doorNote}
        </p>
      </div>
    </div>
  );
}
