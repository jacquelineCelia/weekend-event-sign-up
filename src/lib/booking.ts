import type { Lang } from './event';
import type { PoolClient } from 'pg';
import { randomInt } from 'node:crypto';
import { withTx } from './db';
import type { Contact } from './contact';

export const HOLD_MINUTES = 10;

export class BookingError extends Error {
  constructor(
    public readonly code: 'slot_not_found' | 'not_enough_spots' | 'hold_not_found' | 'hold_expired' | 'booking_not_found' | 'overlap' | 'seats_needed' | 'seats_taken',
    message: string,
    public readonly remaining?: number,
    /** For 'overlap': who is signing up, and their sign-ups that clash with the new one. */
    public readonly overlap?: { personId: string; conflicts: OverlapConflict[] },
  ) {
    super(message);
  }
}

/** One of a person's confirmed sign-ups whose time overlaps the one they are adding. */
export type OverlapConflict = {
  bookingId: string; startsAt: Date; durationMin: number; partySize: number;
  activityName: string; activityNameZh: string; place: string; placeZh: string;
};

/**
 * This person's confirmed sign-ups that overlap the slot (start before it ends and end after it
 * starts). Back-to-back activities don't count. `exclude` skips one booking (the one being moved).
 */
export async function findOverlaps(c: PoolClient, personId: string, slotId: string, exclude?: string): Promise<OverlapConflict[]> {
  const r = await c.query(
    `select b.id, s.starts_at, a.duration_min, b.party_size, a.name, a.name_zh, a.place, a.place_zh
       from slots n
       join activities na on na.id = n.activity_id
       join bookings b on b.person_id = $1 and b.status = 'confirmed' and ($3::uuid is null or b.id <> $3::uuid)
       join slots s on s.id = b.slot_id
       join activities a on a.id = s.activity_id
      where n.id = $2
        and s.starts_at < n.starts_at + make_interval(mins => na.duration_min)
        and n.starts_at < s.starts_at + make_interval(mins => a.duration_min)
      order by s.starts_at`,
    [personId, slotId, exclude ?? null],
  );
  return r.rows.map((x) => ({
    bookingId: x.id, startsAt: x.starts_at, durationMin: x.duration_min, partySize: x.party_size,
    activityName: x.name, activityNameZh: x.name_zh ?? '', place: x.place, placeZh: x.place_zh ?? '',
  }));
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

// ---------- Seating ----------
// Some activities offer kinds of seating (e.g. "High chair" and "Ground seat"), each with its own
// capacity, the same in every time slot. A party says how many of each it needs; the counts add up
// to the party size. Activities without seat types work exactly as before.

/** How many of one seat type a party needs. */
export type SeatPick = { seatTypeId: string; count: number };

/** The slot's activity's seat types, with how many of each are taken in that slot (live holds count). */
async function seatState(c: PoolClient, slotId: string, excludeBookingId?: string) {
  const r = await c.query<{ id: string; name: string; capacity: number; taken: number }>(
    `select st.id, st.name, st.capacity,
            coalesce(sum(bs.count) filter (where b.status = 'confirmed' or (b.status = 'held' and b.hold_expires_at > now())), 0)::int as taken
       from slots s
       join seat_types st on st.activity_id = s.activity_id
       left join booking_seats bs on bs.seat_type_id = st.id
       left join bookings b on b.id = bs.booking_id and b.slot_id = s.id and ($2::uuid is null or b.id <> $2::uuid)
      where s.id = $1
      group by st.id
      order by st.sort_order, st.name`,
    [slotId, excludeBookingId ?? null],
  );
  return r.rows;
}

/**
 * Checks a party's seating for a slot (call with the slot locked). Without seat types: nothing to
 * choose. With them: every person needs a seat, and each type needs room (unless `allowOver`).
 */
async function checkSeats(
  c: PoolClient, slotId: string, partySize: number, seats: SeatPick[] | undefined,
  opts: { exclude?: string; allowOver?: boolean } = {},
): Promise<SeatPick[]> {
  const types = await seatState(c, slotId, opts.exclude);
  if (!types.length) return [];
  const want = new Map<string, number>();
  for (const p of seats ?? []) {
    if (!Number.isInteger(p.count) || p.count < 0) throw new BookingError('seats_needed', 'Please choose seating for everyone.');
    if (p.count > 0) want.set(p.seatTypeId, (want.get(p.seatTypeId) ?? 0) + p.count);
  }
  const total = [...want.values()].reduce((n, x) => n + x, 0);
  if (total !== partySize || [...want.keys()].some((id) => !types.some((t) => t.id === id))) {
    throw new BookingError('seats_needed', 'Please choose seating for everyone.');
  }
  if (!opts.allowOver) {
    for (const t of types) {
      const n = want.get(t.id) ?? 0;
      const left = Math.max(t.capacity - t.taken, 0);
      if (n > left) {
        throw new BookingError('seats_taken', left === 0 ? `No ${t.name} seats are left at this time.` : `Only ${left} ${t.name} left at this time.`, left);
      }
    }
  }
  return [...want].map(([seatTypeId, count]) => ({ seatTypeId, count }));
}

async function saveSeats(c: PoolClient, bookingId: string, picks: SeatPick[]) {
  for (const p of picks) {
    await c.query('insert into booking_seats (booking_id, seat_type_id, count) values ($1, $2, $3)', [bookingId, p.seatTypeId, p.count]);
  }
}

async function seatsOf(c: PoolClient, bookingId: string): Promise<SeatPick[]> {
  const r = await c.query<{ seat_type_id: string; count: number }>('select seat_type_id, count from booking_seats where booking_id = $1', [bookingId]);
  return r.rows.map((x) => ({ seatTypeId: x.seat_type_id, count: x.count }));
}

/** Reserves spots (and seats, if the activity has seat types) for HOLD_MINUTES while the attendee fills in their details. */
export async function holdSpots(slotId: string, partySize: number, seats?: SeatPick[]) {
  if (!Number.isInteger(partySize) || partySize < 1) throw new RangeError('partySize must be a positive integer');
  return withTx(async (c) => {
    const { remaining } = await lockSlot(c, slotId);
    if (remaining < partySize) {
      throw new BookingError('not_enough_spots', remaining === 0 ? 'This time just filled up.' : `Only ${remaining} left at this time.`, remaining);
    }
    const picks = await checkSeats(c, slotId, partySize, seats);
    const res = await c.query<{ id: string; hold_expires_at: Date }>(
      `insert into bookings (slot_id, party_size, status, hold_expires_at)
       values ($1, $2, 'held', now() + make_interval(mins => $3))
       returning id, hold_expires_at`,
      [slotId, partySize, HOLD_MINUTES],
    );
    await saveSeats(c, res.rows[0].id, picks);
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
/**
 * The existing person a sign-up's contact details belong to, without changing anything.
 * Mirrors upsertPerson: by email; else a walk-in record with the same phone and name but no email;
 * without an email, someone with the same phone and the same name.
 */
async function findPerson(c: PoolClient, contact: Contact): Promise<{ id: string; via: 'email' | 'walk_in' | 'phone' } | null> {
  const sameNameOnPhone = async (onlyWithoutEmail: boolean) =>
    contact.phone
      ? (await c.query<{ id: string }>(
          `select id from people where phone = $1 and lower(trim(name)) = lower(trim($2))
             ${onlyWithoutEmail ? 'and email is null' : ''} order by created_at limit 1`,
          [contact.phone, contact.name],
        )).rows[0]?.id ?? null
      : null;
  if (contact.email) {
    const byEmail = (await c.query<{ id: string }>('select id from people where lower(email) = $1', [contact.email])).rows[0]?.id;
    if (byEmail) return { id: byEmail, via: 'email' };
    const walkIn = await sameNameOnPhone(true);
    return walkIn ? { id: walkIn, via: 'walk_in' } : null;
  }
  const existing = await sameNameOnPhone(false);
  return existing ? { id: existing, via: 'phone' } : null;
}

// Serialise sign-ups for the same email (or, without one, the same phone) so two at once
// can't both create a new person, or both slip past the overlap check.
async function lockContact(c: PoolClient, contact: Contact) {
  const key = contact.email ?? contact.phone;
  if (key) await c.query('select pg_advisory_xact_lock(hashtext($1))', [key]);
}

/**
 * Finds or creates the person behind a sign-up. People are told apart by email; a phone number
 * can be shared (a family, a couple), so it only identifies someone together with their name.
 *  - With an email: that email's person (name and phone kept current), else a walk-in record with
 *    the same phone and name but no email yet (the email is added to it), else a new person.
 *  - Without an email (walk-ins): someone with the same phone and the same name, else a new person.
 */
export async function upsertPerson(c: PoolClient, contact: Contact, lang: Lang = 'en'): Promise<string> {
  await lockContact(c, contact);
  const found = await findPerson(c, contact);
  if (found?.via === 'email') {
    await c.query('update people set name = $2, phone = coalesce($3, phone), lang = $4 where id = $1', [found.id, contact.name, contact.phone, lang]);
    return found.id;
  }
  if (found?.via === 'walk_in') {
    await c.query('update people set email = $2, name = $3, lang = $4 where id = $1', [found.id, contact.email, contact.name, lang]);
    return found.id;
  }
  if (found) {
    await c.query('update people set lang = $2 where id = $1', [found.id, lang]);
    return found.id;
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

export type ConfirmInput = {
  contact: Contact; remindSms: boolean; remindEmail: boolean; lang?: Lang;
  /**
   * Cancel these overlapping sign-ups in the same step. `owners` is who the browser is signed in as;
   * only that person's (or household's) bookings, and only the signer-up's own, are cancelled.
   */
  replace?: { bookingIds: string[]; owners: string[] };
};

/**
 * Turns a hold into a confirmed booking. If the hold lapsed, re-checks capacity before confirming.
 * Refuses ('overlap') when the same person already has a sign-up at an overlapping time, unless
 * those are listed in `replace` and the signed-in viewer owns them, in which case they are
 * cancelled in the same transaction (both happen, or neither).
 */
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
      const picks = await seatsOf(c, holdId);
      if (picks.length) {
        await checkSeats(c, row.slot_id, row.party_size, picks, { exclude: holdId }).catch((e) => {
          if (e instanceof BookingError) throw new BookingError('hold_expired', 'Your hold ran out and those seats were taken. Please pick another time.');
          throw e;
        });
      }
    }
    await lockContact(c, input.contact);
    const existing = await findPerson(c, input.contact);
    if (existing) {
      if (input.replace?.bookingIds.length && input.replace.owners.includes(existing.id)) {
        await c.query(
          `update bookings set status = 'cancelled', cancelled_at = now()
            where id = any($1::uuid[]) and person_id = $2 and status = 'confirmed'`,
          [input.replace.bookingIds, existing.id],
        );
      }
      const conflicts = await findOverlaps(c, existing.id, row.slot_id);
      if (conflicts.length) {
        throw new BookingError('overlap', 'You already have a sign-up at an overlapping time.', undefined, { personId: existing.id, conflicts });
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

/** Staff walk-in: books directly (no hold). `allowOver` lets a lead approve going over capacity. Walk-ins are never texted; reminders go by email when there is one. */
export async function walkInBooking(
  slotId: string, partySize: number, contact: Contact,
  opts: { allowOver?: boolean; checkInNow?: boolean; lang?: Lang; seats?: SeatPick[] } = {},
) {
  return withTx(async (c) => {
    const { remaining } = await lockSlot(c, slotId);
    if (remaining < partySize && !opts.allowOver) {
      throw new BookingError('not_enough_spots', `Only ${remaining} left at this time.`, remaining);
    }
    const picks = await checkSeats(c, slotId, partySize, opts.seats, { allowOver: opts.allowOver });
    const personId = await upsertPerson(c, contact, opts.lang);
    const code = await uniqueCode(c);
    const res = await c.query<{ id: string }>(
      `insert into bookings (slot_id, person_id, party_size, status, source, code, remind_sms, remind_email, checked_in, confirmed_at)
       values ($1, $2, $3, 'confirmed', 'walk_in', $4, $5, $6, $7, now()) returning id`,
      [slotId, personId, partySize, code, false, !!contact.email, opts.checkInNow ? partySize : 0],
    );
    await saveSeats(c, res.rows[0].id, picks);
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
    // The same seats are needed at the new time (sign-ups from before seating was set up have none).
    const picks = await seatsOf(c, bookingId);
    if (picks.length) await checkSeats(c, newSlotId, b.rows[0].party_size, picks, { exclude: bookingId });
    await c.query('update bookings set slot_id = $2, reminder_sent_at = null where id = $1', [bookingId, newSlotId]);
  });
}

/**
 * Changes how a confirmed, not-yet-started sign-up is seated (same party size, same time).
 * The new seats need room, not counting the ones this sign-up already has.
 */
export async function changeSeats(bookingId: string, personId: string | string[], seats: SeatPick[]) {
  return withTx(async (c) => {
    const b = await c.query<{ slot_id: string; party_size: number; upcoming: boolean }>(
      `select b.slot_id, b.party_size, s.starts_at > now() as upcoming
         from bookings b join slots s on s.id = b.slot_id
        where b.id = $1 and b.person_id = any($2::uuid[]) and b.status = 'confirmed' for update of b`,
      [bookingId, ownerIds(personId)],
    );
    const row = b.rows[0];
    if (!row || !row.upcoming) throw new BookingError('booking_not_found', 'That booking could not be found.');
    await lockSlot(c, row.slot_id);
    const picks = await checkSeats(c, row.slot_id, row.party_size, seats, { exclude: bookingId });
    if (!picks.length) return; // this activity has no seating choices
    await c.query('delete from booking_seats where booking_id = $1', [bookingId]);
    await saveSeats(c, bookingId, picks);
  });
}
