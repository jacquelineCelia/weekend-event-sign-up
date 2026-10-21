'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { startLogin, verifyLogin } from '@/lib/login';
import { clearPersonSession, setViewerSession } from '@/lib/session';
import { currentOwners } from '@/lib/viewer';
import { BookingError, cancelBooking, changeSeats, changeSlot } from '@/lib/booking';
import { getPool } from '@/lib/db';
import { getLang } from '@/lib/lang';

export type LoginState = { error?: { code: string; left?: number }; value?: string } | null;

export async function startLoginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const value = String(form.get('who') ?? '').trim();
  if (!value) return { error: { code: 'enter_who' }, value };
  const r = await startLogin(value, await getLang());
  if (r.limited) return { error: { code: 'too_many_codes' }, value };
  if (!r.ticket) return { error: { code: 'bad_who' }, value };
  const p = new URLSearchParams({ t: r.ticket, to: r.masked ?? '', via: r.via ?? 'email', ...(r.many ? { m: '1' } : {}) });
  redirect(`/me/sign-in?${p}`);
}

export async function verifyLoginAction(ticket: string, _prev: LoginState, form: FormData): Promise<LoginState> {
  const code = String(form.get('code') ?? '');
  const r = await verifyLogin(ticket, code);
  if ('error' in r) return { error: { code: r.error, left: r.left } };
  await setViewerSession(r.viewer, true);
  redirect('/me');
}

export async function signOutAction() {
  await clearPersonSession();
  redirect('/');
}

const uuid = z.string().uuid();

export async function cancelAction(form: FormData) {
  const { ids } = await currentOwners();
  const id = uuid.safeParse(form.get('bookingId'));
  if (ids.length && id.success) await cancelBooking(id.data, ids).catch(() => {});
  revalidatePath('/me');
}

export async function rateAction(form: FormData) {
  const { ids } = await currentOwners();
  const id = uuid.safeParse(form.get('bookingId'));
  const score = z.coerce.number().int().min(1).max(10).safeParse(form.get('score'));
  if (!ids.length || !id.success || !score.success) return;
  // Only the attendee's own, already-started bookings can be rated.
  await getPool().query(
    `insert into ratings (booking_id, score)
     select b.id, $3 from bookings b join slots s on s.id = b.slot_id
      where b.id = $1 and b.person_id = any($2::uuid[]) and b.status = 'confirmed' and s.starts_at < now()
     on conflict (booking_id) do update set score = excluded.score, updated_at = now()`,
    [id.data, ids, score.data],
  );
  revalidatePath('/me');
}

export type ChangeState = { error?: { code: string; remaining?: number } } | null;

export async function changeTimeAction(bookingId: string, _prev: ChangeState, form: FormData): Promise<ChangeState> {
  const { ids } = await currentOwners();
  const slot = uuid.safeParse(form.get('slotId'));
  if (!ids.length) redirect('/me/sign-in');
  if (!slot.success) return { error: { code: 'pick_time' } };
  try {
    // "Cancel <other> and move here": the clashing sign-ups to cancel in the same step.
    const replace = String(form.get('replace') ?? '').split(',').filter((x) => uuid.safeParse(x).success);
    await changeSlot(bookingId, ids, slot.data, replace);
  } catch (err) {
    if (err instanceof BookingError) return { error: { code: err.code, remaining: err.remaining } };
    throw err;
  }
  redirect('/me?moved=1');
}

/** "Change seating" on a sign-up card: same party, same time, different seats. */
export async function changeSeatsAction(bookingId: string, _prev: ChangeState, form: FormData): Promise<ChangeState> {
  const { ids } = await currentOwners();
  if (!ids.length) redirect('/me/sign-in');
  let seats: { seatTypeId: string; count: number }[];
  try {
    seats = z.array(z.object({ seatTypeId: z.string().uuid(), count: z.number().int().min(0).max(50) })).max(20).parse(JSON.parse(String(form.get('seats') ?? '[]')));
  } catch {
    return { error: { code: 'seats_needed' } };
  }
  try {
    await changeSeats(bookingId, ids, seats);
  } catch (err) {
    if (err instanceof BookingError) return { error: { code: err.code, remaining: err.remaining } };
    throw err;
  }
  revalidatePath('/me');
  redirect('/me?seated=1');
}
