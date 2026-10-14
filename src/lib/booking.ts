import type { PoolClient } from 'pg';
import { randomInt } from 'node:crypto';
import { withTx } from './db';
import type { Contact } from './contact';

export const HOLD_MINUTES = 10;

export class BookingError extends Error {
  constructor(
    public readonly code: 'slot_not_found' | 'not_enough_spots' | 'hold_not_found' | 'hold_expired' | 'booking_not_found',
    message: string,
    public readonly remaining?: number,
  ) {
    super(message);
  }
}

/** Locks the slot row and returns its capacity and spots taken (confirmed + live holds). */
async function lockSlot(c: PoolClient, slotId: string, excludeBookingId?: string) {
  const slot = await c.query<{ capacity: number }>('select capacity from slots where id = $1 for update', [slotId]);
  if (!slot.rowCount) throw new BookingError('slot_not_found', 'That time slot no longer exists.');
  const taken = await c.query<{ taken: number }>(
    `select coalesce(sum(party_size), 0)::int as taken
       from bookings
      where slot_id = $1
        and ($2::uuid is null or id <> $2::uuid)
        and (status = 'confirmed' or (status = 'held' and hold_expires_at > now()))`,
    [slotId, excludeBookingId ?? null],
  );
  const capacity = slot.rows[0].capacity;
  return { capacity, taken: taken.rows[0].taken, remaining: Math.max(capacity - taken.rows[0].taken, 0) };
}

/** Reserves spots for HOLD_MINUTES while the attendee fills in their details. */
export async function holdSpots(slotId: string, partySize: number) {
  if (!Number.isInteger(partySize) || partySize < 1) throw new RangeError('partySize must be a positive integer');
  return withTx(async (c) => {
    const { remaining } = await lockSlot(c, slotId);
    if (remaining < partySize) {
      throw new BookingError('not_enough_spots', remaining === 0 ? 'This time just filled up.' : `Only ${remaining} left at this time.`, remaining);
    }
    const res = await c.query<{ id: string; hold_expires_at: Date }>(
      `insert into bookings (slot_id, party_size, status, hold_expires_at)
       values ($1, $2, 'held', now() + make_interval(mins => $3))
       returning id, hold_expires_at`,
      [slotId, partySize, HOLD_MINUTES],
    );
    return { holdId: res.rows[0].id, expiresAt: res.rows[0].hold_expires_at };
  });
}

/** Lets go of a hold early (e.g. the attendee went back and picked another time). */
export async function releaseHold(holdId: string) {
  await withTx((c) => c.query(`update bookings set status = 'cancelled', cancelled_at = now() where id = $1 and status = 'held'`, [holdId]));
}

// No 0/O or 1/I, so codes are easy to read aloud at the door.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode() {
  return Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

async function uniqueCode(c: PoolClient) {
  for (let i = 0; i < 20; i++) {
    const code = makeCode();
    const hit = await c.query('select 1 from bookings where code = $1', [code]);
    if (!hit.rowCount) return code;
  }
  throw new Error('Could not generate a unique check-in code');
}

/**
 * Finds or creates the person behind a sign-up. People are told apart by email; a phone number
 * can be shared (a family, a couple), so it only identifies someone together with their name.
 *  - With an email: that email's person (name and phone kept current), else a walk-in record with
 *    the same phone and name but no email yet (the email is added to it), else a new person.
 *  - Without an email (walk-ins): someone with the same phone and the same name, else a new person.
 */
export async function upsertPerson(c: PoolClient, contact: Contact, lang: 'en' | 'zh' = 'en'): Promise<string> {
  const sameNameOnPhone = async (onlyWithoutEmail: boolean) =>
    contact.phone
      ? (await c.query<{ id: string }>(
          `select id from people where phone = $1 and lower(trim(name)) = lower(trim($2))
             ${onlyWithoutEmail ? 'and email is null' : ''} order by created_at limit 1`,
          [contact.phone, contact.name],
        )).rows[0]?.id ?? null
      : null;

  // Serialise sign-ups for the same email (or, without one, the same phone) so two at once
  // can't both create a new person.
  const key = contact.email ?? contact.phone;
  if (key) await c.query('select pg_advisory_xact_lock(hashtext($1))', [key]);

  if (contact.email) {
    const byEmail = (await c.query<{ id: string }>('select id from people where lower(email) = $1', [contact.email])).rows[0]?.id;
    if (byEmail) {
      await c.query('update people set name = $2, phone = coalesce($3, phone), lang = $4 where id = $1', [byEmail, contact.name, contact.phone, lang]);
      return byEmail;
    }
    const walkIn = await sameNameOnPhone(true);
    if (walkIn) {
      await c.query('update people set email = $2, name = $3, lang = $4 where id = $1', [walkIn, contact.email, contact.name, lang]);
      return walkIn;
    }
  } else {
    const existing = await sameNameOnPhone(false);
    if (existing) {
      await c.query('update people set lang = $2 where id = $1', [existing, lang]);
      return existing;
    }
  }
  const res = await c.query<{ id: string }>('insert into people (name, email, phone, lang) values ($1, $2, $3, $4) returning id', [
    contact.name,
    contact.email,
    contact.phone,
    lang,
  ]);
  return res.rows[0].id;
}

/** A booking's owner check: one person, or everyone signed in through a shared phone number. */
const ownerIds = (who: string | string[]) => (Array.isArray(who) ? who : [who]);

export type ConfirmInput = { contact: Contact; remindSms: boolean; remindEmail: boolean; lang?: 'en' | 'zh' };

/** Turns a hold into a confirmed booking. If the hold lapsed, re-checks capacity before confirming. */
export async function confirmBooking(holdId: string, input: ConfirmInput) {
  return withTx(async (c) => {
    const b = await c.query<{ slot_id: string; party_size: number; status: string; expired: boolean }>(
      `select slot_id, party_size, status, hold_expires_at <= now() as expired from bookings where id = $1 for update`,
      [holdId],
    );
    const row = b.rows[0];
    if (!row || row.status !== 'held') throw new BookingError('hold_not_found', 'This booking session has ended. Please pick a time again.');
    if (row.expired) {
      const { remaining } = await lockSlot(c, row.slot_id, holdId);
      if (remaining < row.party_size) {
        throw new BookingError('hold_expired', 'Your hold ran out and those spots were taken. Please pick another time.', remaining);
      }
    }
    const personId = await upsertPerson(c, input.contact, input.lang);
    const code = await uniqueCode(c);
    await c.query(
      `update bookings set status = 'confirmed', person_id = $2, code = $3, remind_sms = $4, remind_email = $5,
              hold_expires_at = null, confirmed_at = now()
        where id = $1`,
      [holdId, personId, code, input.remindSms && !!input.contact.phone, input.remindEmail && !!input.contact.email],
    );
    return { bookingId: holdId, personId, code };
  });
}

/** Staff walk-in: books directly (no hold). `allowOver` lets a lead approve going over capacity. */
export async function walkInBooking(slotId: string, partySize: number, contact: Contact, opts: { allowOver?: boolean; checkInNow?: boolean; lang?: 'en' | 'zh' } = {}) {
  return withTx(async (c) => {
    const { remaining } = await lockSlot(c, slotId);
    if (remaining < partySize && !opts.allowOver) {
      throw new BookingError('not_enough_spots', `Only ${remaining} left at this time.`, remaining);
    }
    const personId = await upsertPerson(c, contact, opts.lang);
    const code = await uniqueCode(c);
    const res = await c.query<{ id: string }>(
      `insert into bookings (slot_id, person_id, party_size, status, source, code, remind_sms, remind_email, checked_in, confirmed_at)
       values ($1, $2, $3, 'confirmed', 'walk_in', $4, $5, $6, $7, now()) returning id`,
      [slotId, personId, partySize, code, !!contact.phone, !!contact.email, opts.checkInNow ? partySize : 0],
    );
    return { bookingId: res.rows[0].id, personId, code };
  });
}

/** Cancels a confirmed booking owned by this person (or household), freeing its spots. */
export async function cancelBooking(bookingId: string, personId: string | string[]) {
  const res = await withTx((c) =>
    c.query(
      `update bookings set status = 'cancelled', cancelled_at = now()
        where id = $1 and person_id = any($2::uuid[]) and status = 'confirmed'`,
      [bookingId, ownerIds(personId)],
    ),
  );
  if (!res.rowCount) throw new BookingError('booking_not_found', 'That booking could not be found.');
}

/** Moves a confirmed booking to another slot of the same size, atomically. */
export async function changeSlot(bookingId: string, personId: string | string[], newSlotId: string) {
  return withTx(async (c) => {
    const b = await c.query<{ slot_id: string; party_size: number }>(
      `select slot_id, party_size from bookings where id = $1 and person_id = any($2::uuid[]) and status = 'confirmed' for update`,
      [bookingId, ownerIds(personId)],
    );
    if (!b.rowCount) throw new BookingError('booking_not_found', 'That booking could not be found.');
    const { remaining } = await lockSlot(c, newSlotId);
    if (remaining < b.rows[0].party_size) {
      throw new BookingError('not_enough_spots', `Only ${remaining} left at that time.`, remaining);
    }
    await c.query('update bookings set slot_id = $2, reminder_sent_at = null where id = $1', [bookingId, newSlotId]);
  });
}
