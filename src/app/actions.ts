'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { BookingError, confirmBooking, holdSpots, releaseHold } from '@/lib/booking';
import { contactSchema } from '@/lib/contact';
import { getBooking } from '@/lib/queries';
import { currentViewer, setPersonSession } from '@/lib/session';
import { sendConfirmation } from '@/lib/notify';
import { getLang } from '@/lib/lang';

/** Errors are codes (see i18n.ts) so the screen can show them in either language. */
export type ActionError = { code: string; remaining?: number };
export type FormState = { error?: ActionError; fields?: Record<string, string>; values?: Record<string, string> } | null;

const holdInput = z.object({
  slotId: z.string().uuid({ message: 'pick_time' }),
  guests: z.coerce.number().int().min(0).max(49),
});

export async function holdAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = holdInput.safeParse({ slotId: form.get('slotId'), guests: form.get('guests') ?? 0 });
  if (!parsed.success) return { error: { code: parsed.error.issues[0].path[0] === 'slotId' ? 'pick_time' : 'slot_not_found' } };
  let holdId: string;
  try {
    ({ holdId } = await holdSpots(parsed.data.slotId, parsed.data.guests + 1));
  } catch (err) {
    if (err instanceof BookingError) return { error: { code: err.code, remaining: err.remaining } };
    throw err;
  }
  redirect(`/book/${holdId}`);
}

export async function confirmAction(holdId: string, _prev: FormState, form: FormData): Promise<FormState> {
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
  let result: Awaited<ReturnType<typeof confirmBooking>>;
  try {
    result = await confirmBooking(holdId, {
      contact: parsed.data,
      remindSms: form.get('remindSms') === 'on',
      remindEmail: form.get('remindEmail') === 'on',
      lang: await getLang(),
    });
  } catch (err) {
    if (err instanceof BookingError) return { error: { code: err.code, remaining: err.remaining }, values };
    throw err;
  }
  // Signed in with a shared phone and booking for someone on it? Stay signed in for the whole
  // household; otherwise this browser now belongs to the person who just booked.
  const viewer = await currentViewer();
  if (!(viewer?.kind === 'phone' && viewer.phone === parsed.data.phone)) {
    await setPersonSession(result.personId, form.get('remember') === 'on');
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
