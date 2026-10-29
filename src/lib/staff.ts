import { getPool, withTx } from './db';
import { EVENT } from './event';
import { sendTimeChange } from './notify';
import { sdict } from './staff-i18n';
import { localText } from './hans';
import type { Lang } from './event';

// ---------- Check-in ----------

export type StaffSession = {
  slotId: string; startsAt: Date; durationMin: number; activityName: string; activityNameZh: string; place: string; placeZh: string;
  instructor: string; instructorZh: string;
  capacity: number; booked: number; arrived: number;
};

export async function sessionsForDay(date: string): Promise<StaffSession[]> {
  const { rows } = await getPool().query(
    `select s.id, s.starts_at, a.duration_min, a.name, a.name_zh, a.place, a.place_zh, a.instructor, a.instructor_zh, s.capacity,
            coalesce(sum(b.party_size) filter (where b.status = 'confirmed'), 0)::int as booked,
            coalesce(sum(b.checked_in) filter (where b.status = 'confirmed'), 0)::int as arrived
       from slots s join activities a on a.id = s.activity_id
       left join bookings b on b.slot_id = s.id
      where (s.starts_at at time zone $1)::date = $2::date
      group by s.id, a.id
      order by s.starts_at, a.sort_order, a.name`,
    [EVENT.timeZone, date],
  );
  return rows.map((r) => ({
    slotId: r.id, startsAt: r.starts_at, durationMin: r.duration_min, activityName: r.name, activityNameZh: r.name_zh, place: r.place, placeZh: r.place_zh,
    instructor: r.instructor, instructorZh: r.instructor_zh,
    capacity: r.capacity, booked: r.booked, arrived: r.arrived,
  }));
}

export type RosterRow = { bookingId: string; name: string; phoneLast4: string; code: string; partySize: number; checkedIn: number; walkIn: boolean; lang: 'en' | 'zh' | 'zhs'; seats: string };

export async function roster(slotId: string, lang: Lang = 'en'): Promise<RosterRow[]> {
  const { rows } = await getPool().query(
    `select b.id, p.name, coalesce(right(p.phone, 4), '') as last4, b.code, b.party_size, b.checked_in, b.source, p.lang,
            coalesce((select json_agg(json_build_object('name', st.name, 'nameZh', st.name_zh, 'count', bs.count) order by st.sort_order, st.name)
                        from booking_seats bs join seat_types st on st.id = bs.seat_type_id where bs.booking_id = b.id), '[]') as seats
       from bookings b join people p on p.id = b.person_id
      where b.slot_id = $1 and b.status = 'confirmed'
      order by lower(p.name)`,
    [slotId],
  );
  return rows.map((r) => ({
    bookingId: r.id, name: r.name, phoneLast4: r.last4, code: r.code, partySize: r.party_size, checkedIn: r.checked_in, walkIn: r.source === 'walk_in', lang: r.lang,
    seats: (r.seats as { name: string; nameZh: string; count: number }[]).map((x) => `${localText(x.name, x.nameZh, lang)} × ${x.count}`).join(lang === 'en' ? ', ' : '、'),
  }));
}

/** For the check-in screen: each seat type's capacity and how many are booked in this slot. */
export async function seatCounts(slotId: string, lang: Lang = 'en') {
  const { rows } = await getPool().query<{ name: string; name_zh: string; capacity: number; booked: number }>(
    `select st.name, st.name_zh, st.capacity,
            coalesce(sum(bs.count) filter (where b.status = 'confirmed'), 0)::int as booked
       from slots s join seat_types st on st.activity_id = s.activity_id
       left join booking_seats bs on bs.seat_type_id = st.id
       left join bookings b on b.id = bs.booking_id and b.slot_id = s.id
      where s.id = $1
      group by st.id order by st.sort_order, st.name`,
    [slotId],
  );
  return rows.map((r) => ({ name: localText(r.name, r.name_zh, lang), capacity: r.capacity, booked: r.booked }));
}

export async function setCheckedIn(bookingId: string, count: number) {
  await getPool().query(
    `update bookings set checked_in = greatest(0, least(party_size, $2)) where id = $1 and status = 'confirmed'`,
    [bookingId, Math.trunc(count)],
  );
}

// ---------- Registration by time ----------

/** Every start time in the event, with totals across the activities that start then. */
export type TimeSlotSummary = { startsAt: Date; endsAt: Date; activities: number; capacity: number; booked: number };

export async function startTimes(): Promise<TimeSlotSummary[]> {
  const { rows } = await getPool().query<{ starts_at: Date; ends_at: Date; activities: number; capacity: number; booked: number }>(
    `select s.starts_at, max(s.starts_at + make_interval(mins => a.duration_min)) as ends_at, count(distinct s.id)::int as activities, sum(s.capacity)::int as capacity,
            coalesce(sum((select coalesce(sum(b.party_size), 0) from bookings b where b.slot_id = s.id and b.status = 'confirmed')), 0)::int as booked
       from slots s join activities a on a.id = s.activity_id
      group by s.starts_at
      order by s.starts_at`,
  );
  return rows.map((r) => ({ startsAt: r.starts_at, endsAt: r.ends_at, activities: r.activities, capacity: r.capacity, booked: r.booked }));
}

/** One activity's registration in the slot starting at a given time. */
export type SlotRegistration = {
  slotId: string; activityName: string; activityNameZh: string; place: string; placeZh: string; durationMin: number;
  instructor: string; instructorZh: string;
  capacity: number; booked: number; held: number; arrived: number; parties: number; walkIns: number;
  seats: { name: string; nameZh: string; capacity: number; booked: number }[];
};

export async function registrationAt(startsAt: Date): Promise<SlotRegistration[]> {
  const { rows } = await getPool().query(
    `select s.id, a.name, a.name_zh, a.place, a.place_zh, a.instructor, a.instructor_zh, a.duration_min, s.capacity,
            coalesce(sum(b.party_size) filter (where b.status = 'confirmed'), 0)::int as booked,
            coalesce(sum(b.party_size) filter (where b.status = 'held' and b.hold_expires_at > now()), 0)::int as held,
            coalesce(sum(b.checked_in) filter (where b.status = 'confirmed'), 0)::int as arrived,
            count(b.id) filter (where b.status = 'confirmed')::int as parties,
            count(b.id) filter (where b.status = 'confirmed' and b.source = 'walk_in')::int as walk_ins,
            coalesce((select json_agg(json_build_object('name', st.name, 'nameZh', st.name_zh, 'capacity', st.capacity,
                        'booked', (select coalesce(sum(bs.count), 0) from booking_seats bs join bookings x on x.id = bs.booking_id
                                    where bs.seat_type_id = st.id and x.slot_id = s.id and x.status = 'confirmed'))
                        order by st.sort_order, st.name)
                        from seat_types st where st.activity_id = a.id), '[]') as seats
       from slots s join activities a on a.id = s.activity_id
       left join bookings b on b.slot_id = s.id
      where s.starts_at = $1
      group by s.id, a.id
      order by a.sort_order, a.name`,
    [startsAt],
  );
  return rows.map((r) => ({
    slotId: r.id, activityName: r.name, activityNameZh: r.name_zh, place: r.place, placeZh: r.place_zh, durationMin: r.duration_min,
    instructor: r.instructor, instructorZh: r.instructor_zh,
    capacity: r.capacity, booked: r.booked, held: r.held, arrived: r.arrived, parties: r.parties, walkIns: r.walk_ins,
    seats: (r.seats as { name: string; nameZh: string; capacity: number; booked: number }[]).map((x) => ({ ...x, nameZh: x.nameZh ?? '', booked: Number(x.booked) })),
  }));
}

// ---------- Schedule & capacity ----------

export type SlotEdit = { id: string | null; time: string; capacity: number };
export type ScheduleSlot = { id: string; time: string; capacity: number; booked: number; held: number };

export async function activitiesWithCounts(date: string) {
  const { rows } = await getPool().query<{
    id: string; name: string; place: string; description: string; duration_min: number; slots: number; spots: number;
    name_zh: string; place_zh: string; description_zh: string; instructor: string; instructor_zh: string; last_start: Date | null;
  }>(
    `select a.id, a.name, a.place, a.description, a.duration_min, a.name_zh, a.place_zh, a.description_zh, a.instructor, a.instructor_zh,
            count(s.id)::int as slots, coalesce(sum(s.capacity), 0)::int as spots, max(s.starts_at) as last_start
       from activities a
       left join slots s on s.activity_id = a.id and (s.starts_at at time zone $1)::date = $2::date
      group by a.id order by a.sort_order, a.name`,
    [EVENT.timeZone, date],
  );
  return rows;
}

export async function scheduleFor(activityId: string, date: string): Promise<ScheduleSlot[]> {
  const { rows } = await getPool().query(
    `select s.id, to_char(s.starts_at at time zone $1, 'HH24:MI') as time, s.capacity,
            coalesce(sum(b.party_size) filter (where b.status = 'confirmed'), 0)::int as booked,
            coalesce(sum(b.party_size) filter (where b.status = 'held' and b.hold_expires_at > now()), 0)::int as held
       from slots s left join bookings b on b.slot_id = s.id
      where s.activity_id = $2 and (s.starts_at at time zone $1)::date = $3::date
      group by s.id order by s.starts_at`,
    [EVENT.timeZone, activityId, date],
  );
  return rows.map((r) => ({ id: r.id, time: r.time, capacity: r.capacity, booked: r.booked, held: r.held }));
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Applies one activity-day's edits atomically. Guards bookings; tells moved guests. */
export async function saveSchedule(activityId: string, date: string, edits: SlotEdit[], lang: Lang = 'en'): Promise<{ notified: number } | { error: string }> {
  const t = sdict(lang);
  const moved: { bookingIds: string[]; from: string; to: string }[] = [];
  let nameZh = '';
  const result = await withTx(async (c) => {
    const act = await c.query<{ duration_min: number; name: string; name_zh: string }>('select duration_min, name, name_zh from activities where id = $1 for update', [activityId]);
    if (!act.rowCount) return { error: t.err.activityGone };
    nameZh = act.rows[0].name_zh;
    const dur = act.rows[0].duration_min;
    // With seat types, every slot's capacity is their total (set under Seating, not per slot).
    const seatTotal = (await c.query<{ n: number | null; k: number }>(
      'select sum(capacity)::int as n, count(*)::int as k from seat_types where activity_id = $1', [activityId],
    )).rows[0];
    if (seatTotal.k > 0) edits = edits.map((e) => ({ ...e, capacity: seatTotal.n ?? 0 }));
    // Lock this day's slots so no hold or booking can land while we edit them.
    await c.query(
      `select id from slots where activity_id = $2 and (starts_at at time zone $1)::date = $3::date for update`,
      [EVENT.timeZone, activityId, date],
    );
    const current = await c.query<{ id: string; time: string; booked: number; held: number }>(
      `select s.id, to_char(s.starts_at at time zone $1, 'HH24:MI') as time,
              coalesce(sum(b.party_size) filter (where b.status = 'confirmed'), 0)::int as booked,
              coalesce(sum(b.party_size) filter (where b.status = 'held' and b.hold_expires_at > now()), 0)::int as held
         from slots s left join bookings b on b.slot_id = s.id
        where s.activity_id = $2 and (s.starts_at at time zone $1)::date = $3::date
        group by s.id`,
      [EVENT.timeZone, activityId, date],
    );
    const byId = new Map(current.rows.map((r) => [r.id, r]));

    // Overlaps and duplicates.
    const sorted = [...edits].sort((a, b) => toMin(a.time) - toMin(b.time));
    for (let i = 1; i < sorted.length; i++) {
      if (toMin(sorted[i].time) < toMin(sorted[i - 1].time) + dur) {
        return { error: t.err.slotsOverlap(sorted[i - 1].time, sorted[i].time, dur) };
      }
    }
    for (const e of edits) {
      if (e.id && !byId.has(e.id)) return { error: t.err.scheduleChanged };
      const cur = e.id ? byId.get(e.id)! : null;
      if (cur && e.capacity < cur.booked + cur.held) {
        return { error: t.err.capBelowBooked(cur.time, cur.booked + cur.held) };
      }
    }
    // Deletions: only slots with no bookings.
    const keep = new Set(edits.filter((e) => e.id).map((e) => e.id));
    const removed = current.rows.filter((r) => !keep.has(r.id));
    const busy = removed.find((r) => r.booked + r.held > 0);
    if (busy) return { error: t.err.slotHasBookings(busy.time) };
    for (const r of removed) {
      await c.query(`delete from bookings where slot_id = $1 and status <> 'confirmed'`, [r.id]);
      await c.query('delete from slots where id = $1', [r.id]);
    }
    for (const e of edits) {
      const at = `(($2::date + $3::time)::timestamp at time zone $1)`;
      if (e.id) {
        const cur = byId.get(e.id)!;
        await c.query(`update slots set starts_at = ${at}, capacity = $4 where id = $5`, [EVENT.timeZone, date, e.time, e.capacity, e.id]);
        if (cur.time !== e.time && cur.booked > 0) {
          const ids = await c.query<{ id: string }>(
            `update bookings set reminder_sent_at = null where slot_id = $1 and status = 'confirmed' returning id`,
            [e.id],
          );
          moved.push({ bookingIds: ids.rows.map((r) => r.id), from: cur.time, to: e.time });
        }
      } else {
        await c.query(`insert into slots (activity_id, starts_at, capacity) values ($4, ${at}, $5)`, [EVENT.timeZone, date, e.time, activityId, e.capacity]);
      }
    }
    return { ok: true as const, name: act.rows[0].name };
  });
  if ('error' in result) return { error: result.error as string };

  // Tell guests whose time moved (after the change is committed), each in their own language.
  let notified = 0;
  const at = async (t: string) =>
    (await getPool().query<{ d: Date }>(`select (($1::date + $2::time)::timestamp at time zone $3) as d`, [date, t, EVENT.timeZone])).rows[0].d;
  for (const m of moved) {
    const [from, to] = [await at(m.from), await at(m.to)];
    const people = await getPool().query<{ email: string | null; phone: string | null; code: string; lang: 'en' | 'zh' | 'zhs'; sms: boolean }>(
      `select p.email, p.phone, b.code, p.lang, b.remind_sms as sms from bookings b join people p on p.id = b.person_id where b.id = any($1)`,
      [m.bookingIds],
    );
    for (const p of people.rows) {
      try {
        await sendTimeChange(p, { name: result.name, nameZh }, from, to);
        notified++;
      } catch (e) {
        console.error('time-change notice failed', e);
      }
    }
  }
  return { notified };
}

export type ActivityInput = {
  name: string; place: string; durationMin: number; description: string;
  nameZh: string; placeZh: string; descriptionZh: string;
  /** Who leads it; one per activity, so every time slot shows the same name. Blank: not shown. */
  instructor: string; instructorZh: string;
};

export async function saveActivity(id: string | null, a: ActivityInput) {
  const v = [a.name, a.place, a.durationMin, a.description, a.nameZh, a.placeZh, a.descriptionZh, a.instructor, a.instructorZh];
  if (id) {
    await getPool().query(
      `update activities set name = $2, place = $3, duration_min = $4, description = $5, name_zh = $6, place_zh = $7, description_zh = $8,
                             instructor = $9, instructor_zh = $10
        where id = $1`,
      [id, ...v],
    );
    return id;
  }
  const r = await getPool().query<{ id: string }>(
    `insert into activities (name, place, duration_min, description, name_zh, place_zh, description_zh, instructor, instructor_zh, sort_order)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce((select max(sort_order) + 1 from activities), 1)) returning id`,
    v,
  );
  return r.rows[0].id;
}

// ---------- Seating ----------

export type SeatTypeRow = { id: string; name: string; nameZh: string; capacity: number; minCapacity: number; inUse: boolean };
export type SeatTypeEdit = { id: string | null; name: string; nameZh: string; capacity: number };

/**
 * An activity's seat types. `minCapacity` is the most booked (or on hold) of that type in any one
 * slot, so capacity can't go below it; `inUse` means sign-ups have chosen it, so it can't be removed.
 */
export async function seatTypesFor(activityId: string): Promise<SeatTypeRow[]> {
  const { rows } = await getPool().query(
    `select st.id, st.name, st.name_zh, st.capacity,
            coalesce((select max(n) from (
               select sum(bs.count) as n from booking_seats bs join bookings b on b.id = bs.booking_id
                where bs.seat_type_id = st.id and (b.status = 'confirmed' or (b.status = 'held' and b.hold_expires_at > now()))
                group by b.slot_id) x), 0)::int as min_cap
       from seat_types st where st.activity_id = $1 order by st.sort_order, st.name`,
    [activityId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, nameZh: r.name_zh, capacity: r.capacity, minCapacity: r.min_cap, inUse: r.min_cap > 0 }));
}

/**
 * Replaces an activity's seat types, then sets every one of its slots' capacity to their total.
 * Refuses to drop a type below what's booked in any slot, to remove a type someone has chosen,
 * or to leave any slot with less room than it has sign-ups.
 */
export async function saveSeating(activityId: string, edits: SeatTypeEdit[], lang: Lang = 'en'): Promise<{ ok: true } | { error: string }> {
  const t = sdict(lang);
  return withTx(async (c) => {
    const act = await c.query('select 1 from activities where id = $1 for update', [activityId]);
    if (!act.rowCount) return { error: t.err.activityGone };
    // Lock the activity's slots so no hold or booking lands while seating changes.
    await c.query('select id from slots where activity_id = $1 for update', [activityId]);
    const names = edits.map((e) => e.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return { error: t.err.dupSeatNames };

    const current = await c.query<{ id: string; name: string }>('select id, name from seat_types where activity_id = $1', [activityId]);
    const known = new Map(current.rows.map((r) => [r.id, r.name]));
    for (const e of edits) if (e.id && !known.has(e.id)) return { error: t.err.seatingChanged };

    // Booked (or held) per type per slot.
    const used = await c.query<{ seat_type_id: string; slot_id: string; n: number }>(
      `select bs.seat_type_id, b.slot_id, sum(bs.count)::int as n
         from booking_seats bs join bookings b on b.id = bs.booking_id join seat_types st on st.id = bs.seat_type_id
        where st.activity_id = $1 and (b.status = 'confirmed' or (b.status = 'held' and b.hold_expires_at > now()))
        group by bs.seat_type_id, b.slot_id`,
      [activityId],
    );
    const keep = new Set(edits.filter((e) => e.id).map((e) => e.id!));
    for (const [id, name] of known) {
      if (!keep.has(id) && used.rows.some((u) => u.seat_type_id === id)) return { error: t.err.seatChosen(name) };
    }
    for (const e of edits) {
      const most = Math.max(0, ...used.rows.filter((u) => u.seat_type_id === e.id).map((u) => u.n));
      if (e.capacity < most) return { error: t.err.seatBelowBooked(most, e.name) };
    }
    const total = edits.reduce((n, e) => n + e.capacity, 0);
    if (edits.length) {
      const busy = await c.query<{ time: string; taken: number }>(
        `select to_char(s.starts_at at time zone $3, 'Dy HH24:MI') as time, coalesce(sum(b.party_size), 0)::int as taken
           from slots s join bookings b on b.slot_id = s.id
          where s.activity_id = $1 and (b.status = 'confirmed' or (b.status = 'held' and b.hold_expires_at > now()))
          group by s.id having sum(b.party_size) > $2 limit 1`,
        [activityId, total, EVENT.timeZone],
      );
      if (busy.rowCount) return { error: t.err.seatsTooFew(busy.rows[0].time, busy.rows[0].taken) };
    }

    // Remove dropped types (only ever-cancelled or expired sign-ups point at them).
    for (const id of known.keys()) {
      if (keep.has(id)) continue;
      await c.query('delete from booking_seats where seat_type_id = $1', [id]);
      await c.query('delete from seat_types where id = $1', [id]);
    }
    for (const [i, e] of edits.entries()) {
      if (e.id) {
        await c.query('update seat_types set name = $2, name_zh = $3, capacity = $4, sort_order = $5 where id = $1', [e.id, e.name.trim(), e.nameZh.trim(), e.capacity, i + 1]);
      } else {
        await c.query('insert into seat_types (activity_id, name, name_zh, capacity, sort_order) values ($1, $2, $3, $4, $5)', [activityId, e.name.trim(), e.nameZh.trim(), e.capacity, i + 1]);
      }
    }
    if (edits.length) await c.query('update slots set capacity = $2 where activity_id = $1', [activityId, total]);
    return { ok: true as const };
  });
}
