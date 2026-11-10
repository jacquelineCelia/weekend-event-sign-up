'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { LAST_SLOT_COOKIE, clearStaffSession, isStaff, setStaffSession, staffPasscodeMatches } from '@/lib/session';
import { BookingError, staffChangeParty, walkInBooking } from '@/lib/booking';
import { walkInContactSchema } from '@/lib/contact';
import { getBooking } from '@/lib/queries';
import { sendConfirmation } from '@/lib/notify';
import { setCheckedIn, saveSchedule, saveActivity, saveSeating, staffUpdateContact, upcomingBookingIds, type SlotEdit } from '@/lib/staff';
import { markPhotoShown, removePhoto } from '@/lib/photos';
import { EVENT, addMinutes, dayOf, dayText, fmtTimeL } from '@/lib/event';
import { localText } from '@/lib/hans';
import { errorText } from '@/lib/i18n';
import { STAFF_LANG_COOKIE, isStaffLang, sdict } from '@/lib/staff-i18n';
import { staffLang } from '@/lib/staff-lang';

async function requireStaff() {
  if (!(await isStaff())) redirect('/staff/login');
}

/** The session staff last worked on (a walk-in sign-up, or opened on Check-in); the Check-in tab returns to it. */
async function rememberSlot(slotId: string) {
  (await cookies()).set(LAST_SLOT_COOKIE, slotId, { path: '/staff', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 });
}
export async function rememberSlotAction(slotId: string) {
  await requireStaff();
  if (z.string().uuid().safeParse(slotId).success) await rememberSlot(slotId);
}

/** Takes a photo off the big screen and deletes it. */
export async function removePhotoAction(id: string) {
  await requireStaff();
  await removePhoto(id);
}

/** Called by the show when a new photo appears. No redirect: a running show must stay on screen. */
export async function markPhotoShownAction(id: string) {
  if (await isStaff()) await markPhotoShown(id);
}

/** The EN | 繁中 | 简中 switch on staff screens (and the staff sign-in page). */
export async function setStaffLangAction(lang: string) {
  if (!isStaffLang(lang)) return;
  (await cookies()).set(STAFF_LANG_COOKIE, lang, { path: '/staff', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 });
}

export async function staffLoginAction(_prev: { error?: string } | null, form: FormData) {
  if (!staffPasscodeMatches(String(form.get('passcode') ?? ''))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return { error: sdict(await staffLang()).wrongPasscode };
  }
  await setStaffSession();
  redirect('/staff');
}

export async function staffSignOutAction() {
  await clearStaffSession();
  redirect('/staff/login');
}

export async function checkInAction(bookingId: string, count: number) {
  await requireStaff();
  await setCheckedIn(bookingId, count);
  revalidatePath('/staff');
}

const partySchema = z.object({
  id: z.string().uuid(),
  size: z.number().int().min(1).max(50),
  seats: z.array(z.object({ seatTypeId: z.string().uuid(), count: z.number().int().min(0).max(50) })).max(20),
  allowOver: z.boolean(),
});

/** Check-in: change a party's size and seating. `full`: refused for lack of room, so a lead can approve. */
export async function changePartyAction(input: z.infer<typeof partySchema>): Promise<{ error?: string; full?: boolean }> {
  await requireStaff();
  const ui = await staffLang();
  const v = partySchema.safeParse(input);
  if (!v.success) return { error: sdict(ui).chooseSeatsAll };
  try {
    await staffChangeParty(v.data.id, v.data.size, v.data.seats, { allowOver: v.data.allowOver });
  } catch (err) {
    if (err instanceof BookingError) {
      return { error: errorText(ui, { code: err.code, remaining: err.remaining }), full: err.code === 'not_enough_spots' || err.code === 'seats_taken' };
    }
    throw err;
  }
  revalidatePath('/staff', 'layout');
  return {};
}

export type ContactState = { fields?: Record<string, string>; error?: string; saved?: string };

/** Check-in: correct a guest's name, email or phone; optionally re-send their confirmations to the new email. */
export async function updateContactAction(input: { bookingId: string; name: string; email: string; phone: string; resend: boolean }): Promise<ContactState> {
  await requireStaff();
  const ui = await staffLang();
  const t = sdict(ui);
  const v = walkInContactSchema.safeParse({ name: input.name, email: input.email, phone: input.phone });
  if (!v.success) {
    const fields: Record<string, string> = {};
    for (const i of v.error.issues) fields[String(i.path[0])] ??= errorText(ui, i.message);
    return { fields };
  }
  const id = z.string().uuid().safeParse(input.bookingId);
  if (!id.success) return { error: t.contactFailed };
  const r = await staffUpdateContact(id.data, v.data);
  if (!r) return { error: t.contactDuplicate };
  let sent = 0;
  if (input.resend && r.emailChanged && v.data.email) {
    for (const bid of await upcomingBookingIds(r.personId)) {
      const b = await getBooking(bid);
      if (b) { await sendConfirmation(b, { text: false }); sent++; }
    }
  }
  revalidatePath('/staff', 'layout');
  return { saved: sent ? t.contactSavedSent(sent, v.data.email!) : r.smsOff ? t.contactSavedSms : t.contactSaved };
}

export type WalkInState = {
  error?: string; fields?: Record<string, string>; done?: { name: string; code: string; to: string; checkedIn: boolean };
  /** What was typed, so a refused sign-up keeps the guest's details. */
  values?: Record<string, string>;
  /** The guest already has sign-ups at overlapping times; staff can cancel them and sign up for this one. */
  conflict?: { name: string; slotId: string; items: { id: string; label: string }[] };
} | null;

const walkIn = z.object({
  slotId: z.string().uuid({ message: 'Pick a time' }),
  party: z.coerce.number().int().min(1).max(50),
});

export async function walkInAction(_prev: WalkInState, form: FormData): Promise<WalkInState> {
  await requireStaff();
  const ui = await staffLang();
  const t = sdict(ui);
  const values = { name: String(form.get('name') ?? ''), email: String(form.get('email') ?? ''), phone: String(form.get('phone') ?? '') };
  const base = walkIn.safeParse({ slotId: form.get('slotId'), party: form.get('party') });
  const contact = walkInContactSchema.safeParse({ name: form.get('name') ?? '', email: form.get('email') ?? '', phone: form.get('phone') ?? '' });
  if (!base.success || !contact.success) {
    const fields: Record<string, string> = {};
    for (const i of [...(base.error?.issues ?? []), ...(contact.error?.issues ?? [])]) fields[String(i.path[0])] ??= i.message === 'Pick a time' ? t.pickTime : errorText(ui, i.message);
    return { fields, values };
  }
  const checkInNow = form.get('checkInNow') === 'on';
  // Which language their confirmation and reminders come in.
  const raw = form.get('lang');
  const lang = raw === 'zh' || raw === 'zhs' ? raw : 'en';
  try {
    let seats: { seatTypeId: string; count: number }[] = [];
    try {
      seats = z.array(z.object({ seatTypeId: z.string().uuid(), count: z.number().int().min(0).max(50) })).max(20).parse(JSON.parse(String(form.get('seats') ?? '[]')));
    } catch {
      return { error: t.chooseSeatsAll, values };
    }
    const r = await walkInBooking(base.data.slotId, base.data.party, contact.data, { allowOver: form.get('allowOver') === 'on', checkInNow, lang, seats,
      replace: form.get('replaceClash') === '1' ? form.getAll('clashId').map(String).filter((x) => z.string().uuid().safeParse(x).success) : undefined,
    });
    const b = await getBooking(r.bookingId);
    if (b) await sendConfirmation(b).catch((e) => console.error('walk-in confirmation failed', e));
    await rememberSlot(base.data.slotId);
    revalidatePath('/staff', 'layout');
    return { done: { name: contact.data.name, code: r.code, to: contact.data.email ?? contact.data.phone ?? '', checkedIn: checkInNow } };
  } catch (err) {
    if (err instanceof BookingError && err.code === 'overlap' && err.overlap) {
      const items = err.overlap.conflicts.map((x) => {
        const d = dayOf(x.startsAt);
        const name = localText(x.activityName, x.activityNameZh, ui);
        const when = `${d ? `${dayText(d, 'short', ui)} ` : ''}${fmtTimeL(x.startsAt, ui)}–${fmtTimeL(addMinutes(x.startsAt, x.durationMin), ui)}`;
        const party = x.partySize > 1 ? (ui === 'en' ? ` (${t.partyOf(x.partySize)})` : `（${t.partyOf(x.partySize)}）`) : '';
        return { id: x.bookingId, label: `${name}${ui === 'en' ? ', ' : '，'}${when}${party}` };
      });
      return { values, conflict: { name: contact.data.name, slotId: base.data.slotId, items } };
    }
    if (err instanceof BookingError) return { error: errorText(ui, { code: err.code, remaining: err.remaining }), values };
    throw err;
  }
}

export type ScheduleState = { error?: string; saved?: boolean; notified?: number } | null;

export async function saveScheduleAction(activityId: string, day: string, _prev: ScheduleState, form: FormData): Promise<ScheduleState> {
  await requireStaff();
  let edits: SlotEdit[];
  try {
    edits = z.array(z.object({
      id: z.string().uuid().nullable(),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      capacity: z.number().int().min(0).max(1000),
    })).parse(JSON.parse(String(form.get('slots') ?? '[]')));
  } catch {
    return { error: sdict(await staffLang()).err.badSlots };
  }
  const r = await saveSchedule(activityId, day, edits, await staffLang());
  if ('error' in r) return { error: r.error };
  revalidatePath('/staff', 'layout');
  revalidatePath('/');
  const key = EVENT.days.find((d) => d.date === day)?.key ?? EVENT.days[0].key;
  redirect(`/staff/schedule?day=${key}&a=${activityId}&saved=${r.notified}`);
}

export async function saveActivityAction(activityId: string | null, _prev: ScheduleState, form: FormData): Promise<ScheduleState> {
  await requireStaff();
  const parsed = z.object({
    name: z.string().trim().min(1).max(80),
    place: z.string().trim().min(1).max(80),
    durationMin: z.coerce.number().int().min(5).max(600),
    description: z.string().trim().max(600),
    nameZh: z.string().trim().max(80),
    placeZh: z.string().trim().max(80),
    descriptionZh: z.string().trim().max(600),
    instructor: z.string().trim().max(80),
    instructorZh: z.string().trim().max(80),
  }).safeParse({
    name: form.get('name'), place: form.get('place'), durationMin: form.get('durationMin'), description: form.get('description') ?? '',
    nameZh: form.get('nameZh') ?? '', placeZh: form.get('placeZh') ?? '', descriptionZh: form.get('descriptionZh') ?? '',
    instructor: form.get('instructor') ?? '', instructorZh: form.get('instructorZh') ?? '',
  });
  if (!parsed.success) return { error: sdict(await staffLang()).err.activityFields };
  const id = await saveActivity(activityId, parsed.data);
  revalidatePath('/staff', 'layout');
  revalidatePath('/');
  if (!activityId) redirect(`/staff/schedule?a=${id}`);
  return { saved: true };
}

/** Seating choices for an activity (names and how many of each per time slot). */
export async function saveSeatingAction(activityId: string, dayKey: string, _prev: ScheduleState, form: FormData): Promise<ScheduleState> {
  await requireStaff();
  const parsed = z.array(z.object({
    id: z.string().uuid().nullable(),
    name: z.string().trim().min(1).max(40),
    nameZh: z.string().trim().max(40),
    capacity: z.number().int().min(0).max(1000),
  })).max(10).safeParse((() => { try { return JSON.parse(String(form.get('seats') ?? '[]')); } catch { return null; } })());
  if (!parsed.success) return { error: sdict(await staffLang()).err.seatFields };
  const r = await saveSeating(activityId, parsed.data, await staffLang());
  if ('error' in r) return { error: r.error };
  revalidatePath('/staff', 'layout');
  revalidatePath('/');
  const key = EVENT.days.some((d) => d.key === dayKey) ? dayKey : EVENT.days[0].key;
  redirect(`/staff/schedule?day=${key}&a=${activityId}&seated=1`);
}
