'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { startLogin, verifyLogin } from '@/lib/login';
import { clearPersonSession, currentPersonId, setPersonSession } from '@/lib/session';
import { BookingError, cancelBooking, changeSlot } from '@/lib/booking';
import { getPool } from '@/lib/db';

export type LoginState = { error?: string; value?: string } | null;

export async function startLoginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const value = String(form.get('who') ?? '').trim();
  if (!value) return { error: 'Enter the phone number or email you signed up with.', value };
  const r = await startLogin(value);
  if (r.limited) return { error: 'We just sent you a few codes. Please wait a few minutes and try again.', value };
  if (!r.ticket) return { error: 'That doesn’t look like a phone number or email.', value };
  const p = new URLSearchParams({ t: r.ticket, to: r.masked ?? '', via: r.via ?? 'email' });
  redirect(`/me/sign-in?${p}`);
}

export async function verifyLoginAction(ticket: string, _prev: LoginState, form: FormData): Promise<LoginState> {
  const code = String(form.get('code') ?? '');
  const r = await verifyLogin(ticket, code);
  if ('error' in r) return { error: r.error };
  await setPersonSession(r.personId, true);
  redirect('/me');
}

export async function signOutAction() {
  await clearPersonSession();
  redirect('/');
}

const uuid = z.string().uuid();

export async function cancelAction(form: FormData) {
  const me = await currentPersonId();
  const id = uuid.safeParse(form.get('bookingId'));
  if (me && id.success) await cancelBooking(id.data, me).catch(() => {});
  revalidatePath('/me');
}

export async function rateAction(form: FormData) {
  const me = await currentPersonId();
  const id = uuid.safeParse(form.get('bookingId'));
  const score = z.coerce.number().int().min(1).max(10).safeParse(form.get('score'));
  if (!me || !id.success || !score.success) return;
  // Only the attendee's own, already-started bookings can be rated.
  await getPool().query(
    `insert into ratings (booking_id, score)
     select b.id, $3 from bookings b join slots s on s.id = b.slot_id
      where b.id = $1 and b.person_id = $2 and b.status = 'confirmed' and s.starts_at < now()
     on conflict (booking_id) do update set score = excluded.score, updated_at = now()`,
    [id.data, me, score.data],
  );
  revalidatePath('/me');
}

export type ChangeState = { error?: string } | null;

export async function changeTimeAction(bookingId: string, _prev: ChangeState, form: FormData): Promise<ChangeState> {
  const me = await currentPersonId();
  const slot = uuid.safeParse(form.get('slotId'));
  if (!me) redirect('/me/sign-in');
  if (!slot.success) return { error: 'Please pick a time' };
  try {
    await changeSlot(bookingId, me, slot.data);
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    throw err;
  }
  redirect('/me?moved=1');
}
