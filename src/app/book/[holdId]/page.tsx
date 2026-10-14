import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { bookingText, getBooking, getPerson } from '@/lib/queries';
import { dayOf, dayText, fmtTimeL } from '@/lib/event';
import { getLang } from '@/lib/lang';
import { dict, firstName } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import { currentPersonId } from '@/lib/session';
import { Back } from '@/components/icons';
import DetailsForm from './DetailsForm';

export const dynamic = 'force-dynamic';

export default async function Details({ params }: { params: Promise<{ holdId: string }> }) {
  const { holdId } = await params;
  const b = await getBooking(holdId);
  if (!b) notFound();
  if (b.status === 'confirmed') redirect(`/booked/${b.id}`);
  const lang = await getLang();
  const t = dict(lang);
  if (b.status === 'cancelled') {
    return (
      <div className="phone">
        <div className="topbar"><Link className="back" href={`/activity/${b.activityId}?slot=${b.slotId}`}><Back /> {t.back}</Link><LangToggle lang={lang} /></div>
        <section className="pad stack" style={{ gap: 14, paddingTop: 20 }}>
          <h1 className="h1">{t.holdEndedTitle}</h1>
          <p className="lede">{t.holdEndedBody}</p>
          <Link className="btn" href={`/activity/${b.activityId}?slot=${b.slotId}`}>{t.pickTime}</Link>
        </section>
      </div>
    );
  }

  const personId = await currentPersonId();
  const person = personId ? await getPerson(personId) : null;
  const day = dayOf(b.startsAt);
  const { activity, place } = bookingText(b, lang);

  return (
    <DetailsForm
      holdId={b.id}
      expiresAt={b.holdExpiresAt!.toISOString()}
      lang={lang}
      summary={{
        activity,
        when: `${day ? dayText(day, 'short', lang) : ''} · ${fmtTimeL(b.startsAt, lang)} · ${place}`,
        spots: t.spots(b.partySize),
        partySize: b.partySize,
      }}
      known={person ? { name: person.name, first: firstName(person.name), email: person.email ?? '', phone: person.phone ?? '' } : null}
    />
  );
}
