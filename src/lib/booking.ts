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

/** Finds the attendee by phone, then email, creating them if new; keeps their details current. */
export async function upsertPerson(c: PoolClient, contact: Contact): Promise<string> {
  let existing = null as null | { id: string };
  if (contact.phone) {
    existing = (await c.query<{ id: string }>('select id from people where phone = $1', [contact.phone])).rows[0] ?? null;
  }
  if (!existing && contact.email) {
    existing = (await c.query<{ id: string }>('select id from people where lower(email) = $1', [contact.email])).rows[0] ?? null;
  }
  if (existing) {
    // Only fill in contact details that are not already used by someone else.
    await c.query(
      `update people p set name = $2,
              phone = coalesce((select $3::text where not exists (select 1 from people o where o.phone = $3 and o.id <> p.id)), p.phone),
              email = coalesce((select $4::text where not exists (select 1 from people o where lower(o.email) = $4 and o.id <> p.id)), p.email)
        where p.id = $1`,
      [existing.id, contact.name, contact.phone, contact.email],
    );
    return existing.id;
  }
  const res = await c.query<{ id: string }>('insert into people (name, email, phone) values ($1, $2, $3) returning id', [
    contact.name,
    contact.email,
    contact.phone,
  ]);
  return res.rows[0].id;
}

export type ConfirmInput = { contact: Contact; remindSms: boolean; remindEmail: boolean };

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
    const personId = await upsertPerson(c, input.contact);
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
export async function walkInBooking(slotId: string, partySize: number, contact: Contact, opts: { allowOver?: boolean; checkInNow?: boolean } = {}) {
  return withTx(async (c) => {
    const { remaining } = await lockSlot(c, slotId);
    if (remaining < partySize && !opts.allowOver) {
      throw new BookingError('not_enough_spots', `Only ${remaining} left at this time.`, remaining);
    }
    const personId = await upsertPerson(c, contact);
    const code = await uniqueCode(c);
    const res = await c.query<{ id: string }>(
      `insert into bookings (slot_id, person_id, party_size, status, source, code, remind_sms, remind_email, checked_in, confirmed_at)
       values ($1, $2, $3, 'confirmed', 'walk_in', $4, $5, $6, $7, now()) returning id`,
      [slotId, personId, partySize, code, !!contact.phone, !!contact.email, opts.checkInNow ? partySize : 0],
    );
    return { bookingId: res.rows[0].id, personId, code };
  });
}

/** Cancels a confirmed booking owned by this person, freeing its spots. */
export async function cancelBooking(bookingId: string, personId: string) {
  const res = await withTx((c) =>
    c.query(
      `update bookings set status = 'cancelled', cancelled_at = now()
        where id = $1 and person_id = $2 and status = 'confirmed'`,
      [bookingId, personId],
    ),
  );
  if (!res.rowCount) throw new BookingError('booking_not_found', 'That booking could not be found.');
}

/** Moves a confirmed booking to another slot of the same size, atomically. */
export async function changeSlot(bookingId: string, personId: string, newSlotId: string) {
  return withTx(async (c) => {
    const b = await c.query<{ slot_id: string; party_size: number }>(
      `select slot_id, party_size from bookings where id = $1 and person_id = $2 and status = 'confirmed' for update`,
      [bookingId, personId],
    );
    if (!b.rowCount) throw new BookingError('booking_not_found', 'That booking could not be found.');
    const { remaining } = await lockSlot(c, newSlotId);
    if (remaining < b.rows[0].party_size) {
      throw new BookingError('not_enough_spots', `Only ${remaining} left at that time.`, remaining);
    }
    await c.query('update bookings set slot_id = $2, reminder_sent_at = null where id = $1', [bookingId, newSlotId]);
  });
}
