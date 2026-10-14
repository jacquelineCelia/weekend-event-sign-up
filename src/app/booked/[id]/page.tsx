import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBooking } from '@/lib/queries';
import { addMinutes, dayOf, fmtTime } from '@/lib/event';
import { currentOwners } from '@/lib/viewer';
import { Bell, Sprout } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function Booked({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await getBooking(id);
  const { ids } = await currentOwners();
  // Only the person who booked can see the ticket (it holds their code).
  if (!b || b.status !== 'confirmed' || !b.personId || !ids.includes(b.personId)) notFound();

  const day = dayOf(b.startsAt);
  const channels = [b.remindSms ? 'text' : null, b.remindEmail ? 'email' : null].filter(Boolean).join(' and ');
  const first = b.personName?.split(' ')[0] ?? '';

  return (
    <div className="phone">
      <div className="pad stack" style={{ gap: 24, padding: '44px 20px 28px' }}>
        <div className="stack" style={{ gap: 14, alignItems: 'flex-start' }}>
          <span className="leafmark"><Sprout /></span>
          <h1 className="h1" style={{ fontSize: 34 }}>You&apos;re in{first ? `, ${first}` : ''}.</h1>
          <p className="lede">
            Take a breath — it&apos;s all set.{b.personEmail ? ` A confirmation is on its way to ${b.personEmail}.` : ''}
          </p>
        </div>

        <article className="ticket">
          <div className="top">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--moss)' }}>{day?.long}</span>
            <span className="serif" style={{ fontSize: 24 }}>{b.activityName}</span>
            <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>
              {fmtTime(b.startsAt)} – {fmtTime(addMinutes(b.startsAt, b.durationMin))} · {b.place}
            </span>
          </div>
          <div className="mid">
            <div className="stack" style={{ gap: 2 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>Party</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{b.partySize} {b.partySize === 1 ? 'spot' : 'spots'}</span>
            </div>
            <div className="stack" style={{ gap: 2 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>Check-in code</span>
              <span className="code">{b.code}</span>
            </div>
          </div>
          <div className="bottom">
            <Bell />
            <span>
              {channels
                ? `We'll ${channels === 'text' ? 'text' : channels === 'email' ? 'email' : 'text and email'} you at ${fmtTime(addMinutes(b.startsAt, -15))}, 15 minutes before it starts.`
                : 'You chose not to get a reminder for this one.'}
            </span>
          </div>
        </article>

        <div className="stack" style={{ gap: 10 }}>
          <Link className="btn" href="/">Sign up for another activity</Link>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Link className="btn ghost" href="/me">My sign-ups</Link>
            <a className="btn ghost" href={`/booked/${b.id}/calendar`} download>Add to calendar</a>
          </div>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
          Show your name, phone number or code at the door. Plans changed? Cancel from My sign-ups so someone else can enjoy your spots.
        </p>
      </div>
    </div>
  );
}
