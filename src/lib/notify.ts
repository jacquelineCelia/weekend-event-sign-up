import type { BookingView } from './queries';
import { EVENT, addMinutes, fmtTime, dayOf } from './event';

// Messaging is wired up in the reminders phase (Twilio + Resend). Until then,
// messages are logged so the flow can be exercised end to end.
export async function sendConfirmation(b: BookingView) {
  const day = dayOf(b.startsAt);
  const when = `${day?.short ?? ''} · ${fmtTime(b.startsAt)}`;
  const reminderAt = fmtTime(addMinutes(b.startsAt, -15));
  console.info(
    `[notify] confirmation → ${b.personEmail ?? b.personPhone}: ${EVENT.name} — ${b.activityName}, ${when}, ${b.place}. ` +
      `${b.partySize} spot(s), code ${b.code}. Reminder at ${reminderAt}.`,
  );
}
