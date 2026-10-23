'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { BookingError, confirmBooking, holdSpots, releaseHold, type OverlapConflict } from '@/lib/booking';
import { contactSchema } from '@/lib/contact';
import { getBooking } from '@/lib/queries';
import { getPool } from '@/lib/db';
import { currentViewer, setPersonSession, setViewerSession } from '@/lib/session';
import { currentOwners } from '@/lib/viewer';
import { startLogin, verifyLogin } from '@/lib/login';
import { sendConfirmation } from '@/lib/notify';
import { getLang } from '@/lib/lang';
import { addMinutes, dayOf, dayText, fmtTimeL, type Lang } from '@/lib/event';
import { localText } from '@/lib/hans';

/** Errors are codes (see i18n.ts) so the screen can show them in either language. */
export type ActionError = { code: string; remaining?: number; left?: number };

/** A clashing sign-up, ready to show. */
export type ConflictItem = { id: string; activity: string; when: string; place: string; partySize: number };
/**
 * The person already has a sign-up at an overlapping time. Its details (and the option to cancel it)
 * are shown only once this browser is signed in as them; until then they can ask for a sign-in code.
 */
export type Conflict =
  | { owned: true; items: ConflictItem[] }
  | { owned: false; ticket?: string; masked?: string; via?: 'email' | 'sms'; codeError?: ActionError };

export type FormState = { error?: ActionError; fields?: Record<string, string>; values?: Record<string, string>; conflict?: Conflict } | null;

const holdInput = z.object({
  slotId: z.string().uuid({ message: 'pick_time' }),
  guests: z.coerce.number().int().min(0).max(49),
});
// How the party is seated, for activities with seat types: [{ seatTypeId, count }].
const seatsInput = z.array(z.object({ seatTypeId: z.string().uuid(), count: z.number().int().min(0).max(50) })).max(20);
const parseSeats = (raw: FormDataEntryValue | null) => {
  try {
    const r = seatsInput.safeParse(JSON.parse(String(raw ?? '[]')));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
};

export async function holdAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = holdInput.safeParse({ slotId: form.get('slotId'), guests: form.get('guests') ?? 0 });
  if (!parsed.success) return { error: { code: parsed.error.issues[0].path[0] === 'slotId' ? 'pick_time' : 'slot_not_found' } };
  const seats = parseSeats(form.get('seats'));
  if (!seats) return { error: { code: 'seats_needed' } };
  let holdId: string;
  try {
    ({ holdId } = await holdSpots(parsed.data.slotId, parsed.data.guests + 1, seats));
  } catch (err) {
    if (err instanceof BookingError) return { error: { code: err.code, remaining: err.remaining } };
    throw err;
  }
  redirect(`/book/${holdId}`);
}

function conflictItems(conflicts: OverlapConflict[], lang: Lang): ConflictItem[] {
  return conflicts.map((x) => {
    const day = dayOf(x.startsAt);
    return {
      id: x.bookingId,
      activity: localText(x.activityName, x.activityNameZh, lang),
      when: `${day ? `${dayText(day, 'short', lang)} · ` : ''}${fmtTimeL(x.startsAt, lang)}–${fmtTimeL(addMinutes(x.startsAt, x.durationMin), lang)}`,
      place: localText(x.place, x.placeZh, lang),
      partySize: x.partySize,
    };
  });
}

const uuid = z.string().uuid();

/**
 * The details form. Besides confirming, its buttons can (field "intent"):
 *  - "replace": cancel the listed overlapping sign-ups ("replace" fields) and confirm, in one step;
 *  - "send_code" / "verify": prove this is the person's email (a sign-in code), so their clashing
 *    sign-up can be shown and cancelled. On a correct code the browser is signed in and the
 *    sign-up is tried again.
 */
export async function confirmAction(holdId: string, prev: FormState, form: FormData): Promise<FormState> {
  const values = {
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    phone: String(form.get('phone') ?? ''),
  };
  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
    return { fields, values };
  }
  const lang = await getLang();
  const intent = String(form.get('intent') ?? 'confirm');
  const remember = form.get('remember') === 'on';

  if (intent === 'send_code' && prev?.conflict && !prev.conflict.owned) {
    // The code goes to the email they typed (or, for a walk-in record with no email yet, the emails on
    // that phone). Never by text here: this screen has no texting disclosure for sign-in codes.
    const byEmail = await getPool().query('select 1 from people where lower(email) = $1', [parsed.data.email]);
    const r = await startLogin((byEmail.rowCount ? parsed.data.email : parsed.data.phone) ?? '', lang);
    if (r.limited || !r.ticket) {
      return { values, conflict: { owned: false, codeError: { code: r.limited ? 'too_many_codes' : 'bad_who' } } };
    }
    return { values, conflict: { owned: false, ticket: r.ticket, masked: r.masked ?? '', via: r.via ?? 'email' } };
  }
  if (intent === 'verify' && prev?.conflict && !prev.conflict.owned && prev.conflict.ticket) {
    const r = await verifyLogin(prev.conflict.ticket, String(form.get('code') ?? ''));
    if ('error' in r) return { values, conflict: { ...prev.conflict, codeError: { code: r.error, left: r.left } } };
    await setViewerSession(r.viewer, remember);
    // Fall through: try the sign-up again, now signed in.
  }

  const { ids: owners } = await currentOwners();
  const replace = intent === 'replace'
    ? { bookingIds: form.getAll('replace').map(String).filter((x) => uuid.safeParse(x).success), owners }
    : undefined;

  let result: Awaited<ReturnType<typeof confirmBooking>>;
  try {
    result = await confirmBooking(holdId, {
      contact: parsed.data,
      remindSms: form.get('remindSms') === 'on',
      remindEmail: form.get('remindEmail') === 'on',
      lang,
      replace,
    });
  } catch (err) {
    if (err instanceof BookingError && err.code === 'overlap' && err.overlap) {
      const conflict: Conflict = owners.includes(err.overlap.personId)
        ? { owned: true, items: conflictItems(err.overlap.conflicts, lang) }
        : { owned: false };
      return { values, conflict };
    }
    if (err instanceof BookingError) return { error: { code: err.code, remaining: err.remaining }, values };
    throw err;
  }
  // Signed in with a shared phone and booking for someone on it? Stay signed in for the whole
  // household; otherwise this browser now belongs to the person who just booked.
  const viewer = await currentViewer();
  if (!(viewer?.kind === 'phone' && viewer.phone === parsed.data.phone)) {
    await setPersonSession(result.personId, remember);
  }
  const booking = await getBooking(result.bookingId);
  if (booking) await sendConfirmation(booking).catch((e) => console.error('confirmation failed', e));
  redirect(`/booked/${result.bookingId}`);
}

/** "Change" on the details screen: let the held spots go, then return to the time picker. */
export async function changeTimeAction(holdId: string) {
  const b = await getBooking(holdId);
  await releaseHold(holdId);
  redirect(b ? `/activity/${b.activityId}?slot=${b.slotId}` : '/');
}
