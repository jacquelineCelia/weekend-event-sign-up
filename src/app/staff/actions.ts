'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { LAST_SLOT_COOKIE, clearStaffSession, isStaff, setStaffSession, staffPasscodeMatches } from '@/lib/session';
import { BookingError, walkInBooking } from '@/lib/booking';
import { walkInContactSchema } from '@/lib/contact';
import { getBooking } from '@/lib/queries';
import { sendConfirmation } from '@/lib/notify';
import { setCheckedIn, saveSchedule, saveActivity, type SlotEdit } from '@/lib/staff';
import { EVENT } from '@/lib/event';
import { errorText } from '@/lib/i18n';

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

export async function staffLoginAction(_prev: { error?: string } | null, form: FormData) {
  if (!staffPasscodeMatches(String(form.get('passcode') ?? ''))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return { error: 'That passcode isn’t right.' };
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

export type WalkInState = { error?: string; fields?: Record<string, string>; done?: { name: string; code: string; to: string; checkedIn: boolean } } | null;

const walkIn = z.object({
  slotId: z.string().uuid({ message: 'Pick a time' }),
  party: z.coerce.number().int().min(1).max(50),
});

export async function walkInAction(_prev: WalkInState, form: FormData): Promise<WalkInState> {
  await requireStaff();
  const base = walkIn.safeParse({ slotId: form.get('slotId'), party: form.get('party') });
  const contact = walkInContactSchema.safeParse({ name: form.get('name') ?? '', email: form.get('email') ?? '', phone: form.get('phone') ?? '' });
  if (!base.success || !contact.success) {
    const fields: Record<string, string> = {};
    for (const i of [...(base.error?.issues ?? []), ...(contact.error?.issues ?? [])]) fields[String(i.path[0])] ??= errorText('en', i.message);
    return { fields };
  }
  const checkInNow = form.get('checkInNow') === 'on';
  // Which language their confirmation and reminders come in.
  const raw = form.get('lang');
  const lang = raw === 'zh' || raw === 'zhs' ? raw : 'en';
  try {
    const r = await walkInBooking(base.data.slotId, base.data.party, contact.data, { allowOver: form.get('allowOver') === 'on', checkInNow, lang });
    const b = await getBooking(r.bookingId);
    if (b) await sendConfirmation(b).catch((e) => console.error('walk-in confirmation failed', e));
    await rememberSlot(base.data.slotId);
    revalidatePath('/staff', 'layout');
    return { done: { name: contact.data.name, code: r.code, to: contact.data.email ?? contact.data.phone ?? '', checkedIn: checkInNow } };
  } catch (err) {
    if (err instanceof BookingError) return { error: errorText('en', { code: err.code, remaining: err.remaining }) };
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
    return { error: 'Some times or capacities aren’t valid.' };
  }
  const r = await saveSchedule(activityId, day, edits);
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
  }).safeParse({
    name: form.get('name'), place: form.get('place'), durationMin: form.get('durationMin'), description: form.get('description') ?? '',
    nameZh: form.get('nameZh') ?? '', placeZh: form.get('placeZh') ?? '', descriptionZh: form.get('descriptionZh') ?? '',
  });
  if (!parsed.success) return { error: 'Name, place and a length in minutes are required.' };
  const id = await saveActivity(activityId, parsed.data);
  revalidatePath('/staff', 'layout');
  revalidatePath('/');
  if (!activityId) redirect(`/staff/schedule?a=${id}`);
  return { saved: true };
}
