import { bookingText, getBooking } from '@/lib/queries';
import { addMinutes } from '@/lib/event';
import { eventName } from '@/lib/hans';
import { getLang } from '@/lib/lang';
import { currentOwners } from '@/lib/viewer';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

/** A one-event .ics file with a 15-minute alarm. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = await getBooking(id);
  const { ids } = await currentOwners();
  if (!b || b.status !== 'confirmed' || !b.personId || !ids.includes(b.personId)) return new Response('Not found', { status: 404 });

  const lang = await getLang();
  const { activity, place, instructor } = bookingText(b, lang);
  const summary = `${activity} · ${eventName(lang)}`;
  const led = instructor ? (lang === 'zh' ? `引導：${instructor}。` : lang === 'zhs' ? `引导：${instructor}。` : `Led by ${instructor}. `) : '';
  const description = led +
    (lang === 'zh' ? `${b.partySize} 位。報到代碼 ${b.code}。` : lang === 'zhs' ? `${b.partySize} 位。签到码 ${b.code}。` : `${b.partySize} spot(s). Check-in code ${b.code}.`);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mindfulness Weekend//Signup//EN', 'BEGIN:VEVENT',
    `UID:${b.id}@signup`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.startsAt)}`, `DTEND:${stamp(addMinutes(b.startsAt, b.durationMin))}`,
    `SUMMARY:${esc(summary)}`, `LOCATION:${esc(place)}`,
    `DESCRIPTION:${esc(description)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${esc(activity)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // ASCII name for old clients, plus the real (possibly Chinese) name for everyone else.
      'Content-Disposition': `attachment; filename="${b.activityName.replace(/[^\w ]/g, '') || 'activity'}.ics"; filename*=UTF-8''${encodeURIComponent(activity)}.ics`,
    },
  });
}
