import { getBooking } from '@/lib/queries';
import { EVENT, addMinutes } from '@/lib/event';
import { currentPersonId } from '@/lib/session';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

/** A one-event .ics file with a 15-minute alarm. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await getBooking(id);
  const me = await currentPersonId();
  if (!b || b.status !== 'confirmed' || b.personId !== me) return new Response('Not found', { status: 404 });

  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mindfulness Weekend//Signup//EN', 'BEGIN:VEVENT',
    `UID:${b.id}@signup`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.startsAt)}`, `DTEND:${stamp(addMinutes(b.startsAt, b.durationMin))}`,
    `SUMMARY:${esc(`${b.activityName} · ${EVENT.name}`)}`, `LOCATION:${esc(b.place)}`,
    `DESCRIPTION:${esc(`${b.partySize} spot(s). Check-in code ${b.code}.`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(b.activityName)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${b.activityName.replace(/[^\w ]/g, '')}.ics"`,
    },
  });
}
