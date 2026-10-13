import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getBooking, getPerson } from '@/lib/queries';
import { dayOf, fmtTime } from '@/lib/event';
import { currentPersonId } from '@/lib/session';
import { Back } from '@/components/icons';
import DetailsForm from './DetailsForm';

export const dynamic = 'force-dynamic';

export default async function Details({ params }: { params: Promise<{ holdId: string }> }) {
  const { holdId } = await params;
  const b = await getBooking(holdId);
  if (!b) notFound();
  if (b.status === 'confirmed') redirect(`/booked/${b.id}`);
  if (b.status === 'cancelled') {
    return (
      <div className="phone">
        <div className="topbar"><Link className="back" href={`/activity/${b.activityId}?slot=${b.slotId}`}><Back /> Back</Link></div>
        <section className="pad stack" style={{ gap: 14, paddingTop: 20 }}>
          <h1 className="h1">This hold has ended</h1>
          <p className="lede">Your spots were released. Pick a time again to continue.</p>
          <Link className="btn" href={`/activity/${b.activityId}?slot=${b.slotId}`}>Pick a time</Link>
        </section>
      </div>
    );
  }

  const personId = await currentPersonId();
  const person = personId ? await getPerson(personId) : null;
  const day = dayOf(b.startsAt);

  return (
    <DetailsForm
      holdId={b.id}
      expiresAt={b.holdExpiresAt!.toISOString()}
      summary={{
        activity: b.activityName,
        when: `${day?.short ?? ''} · ${fmtTime(b.startsAt)} · ${b.place}`,
        spots: `${b.partySize} ${b.partySize === 1 ? 'spot' : 'spots'}`,
        partySize: b.partySize,
      }}
      known={person ? { name: person.name, email: person.email ?? '', phone: person.phone ?? '' } : null}
    />
  );
}
