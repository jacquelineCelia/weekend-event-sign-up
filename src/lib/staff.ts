import { getPool, withTx } from './db';
import { EVENT } from './event';
import { sendEmail, sendSms, smsEnabled } from './messaging';

// ---------- Check-in ----------

export type StaffSession = {
  slotId: string; startsAt: Date; durationMin: number; activityName: string; place: string;
  capacity: number; booked: number; arrived: number;
};

export async function sessionsForDay(date: string): Promise<StaffSession[]> {
  const { rows } = await getPool().query(
    `select s.id, s.starts_at, a.duration_min, a.name, a.place, s.capacity,
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
    slotId: r.id, startsAt: r.starts_at, durationMin: r.duration_min, activityName: r.name, place: r.place,
    capacity: r.capacity, booked: r.booked, arrived: r.arrived,
  }));
}

export type RosterRow = { bookingId: string; name: string; phoneLast4: string; code: string; partySize: number; checkedIn: number; walkIn: boolean };

export async function roster(slotId: string): Promise<RosterRow[]> {
  const { rows } = await getPool().query(
    `select b.id, p.name, coalesce(right(p.phone, 4), '') as last4, b.code, b.party_size, b.checked_in, b.source
       from bookings b join people p on p.id = b.person_id
      where b.slot_id = $1 and b.status = 'confirmed'
      order by lower(p.name)`,
    [slotId],
  );
  return rows.map((r) => ({
    bookingId: r.id, name: r.name, phoneLast4: r.last4, code: r.code, partySize: r.party_size, checkedIn: r.checked_in, walkIn: r.source === 'walk_in',
  }));
}

export async function setCheckedIn(bookingId: string, count: number) {
  await getPool().query(
    `update bookings set checked_in = greatest(0, least(party_size, $2)) where id = $1 and status = 'confirmed'`,
    [bookingId, Math.trunc(count)],
  );
}

// ---------- Schedule & capacity ----------

export type SlotEdit = { id: string | null; time: string; capacity: number };
export type ScheduleSlot = { id: string; time: string; capacity: number; booked: number; held: number };

export async function activitiesWithCounts(date: string) {
  const { rows } = await getPool().query<{ id: string; name: string; place: string; description: string; duration_min: number; slots: number; spots: number }>(
    `select a.id, a.name, a.place, a.description, a.duration_min,
            count(s.id)::int as slots, coalesce(sum(s.capacity), 0)::int as spots
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
export async function saveSchedule(activityId: string, date: string, edits: SlotEdit[]): Promise<{ notified: number } | { error: string }> {
  const moved: { bookingIds: string[]; from: string; to: string }[] = [];
  const result = await withTx(async (c) => {
    const act = await c.query<{ duration_min: number; name: string }>('select duration_min, name from activities where id = $1 for update', [activityId]);
    if (!act.rowCount) return { error: 'That activity no longer exists.' };
    const dur = act.rows[0].duration_min;
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
        return { error: `The ${sorted[i - 1].time} and ${sorted[i].time} slots overlap (each runs ${dur} min).` };
      }
    }
    for (const e of edits) {
      if (e.id && !byId.has(e.id)) return { error: 'Someone else changed this schedule. Reload and try again.' };
      const cur = e.id ? byId.get(e.id)! : null;
      if (cur && e.capacity < cur.booked + cur.held) {
        return { error: `The ${cur.time} slot already has ${cur.booked + cur.held} people; capacity can't go below that.` };
      }
    }
    // Deletions: only slots with no bookings.
    const keep = new Set(edits.filter((e) => e.id).map((e) => e.id));
    const removed = current.rows.filter((r) => !keep.has(r.id));
    const busy = removed.find((r) => r.booked + r.held > 0);
    if (busy) return { error: `The ${busy.time} slot has bookings, so it can't be deleted.` };
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

  // Tell guests whose time moved (after the change is committed).
  let notified = 0;
  for (const m of moved) {
    const people = await getPool().query<{ name: string; email: string | null; phone: string | null; code: string }>(
      `select p.name, p.email, p.phone, b.code from bookings b join people p on p.id = b.person_id where b.id = any($1)`,
      [m.bookingIds],
    );
    for (const p of people.rows) {
      const text = `${EVENT.name}: time change. ${result.name} now starts at ${hhmm(m.to)} (was ${hhmm(m.from)}). Your spots and code ${p.code} stay the same.`;
      try {
        if (p.phone && smsEnabled()) await sendSms(p.phone, text);
        else if (p.email) await sendEmail(p.email, `Time change: ${result.name} now at ${hhmm(m.to)}`, text);
        notified++;
      } catch (e) {
        console.error('time-change notice failed', e);
      }
    }
  }
  return { notified };
}

const hhmm = (t: string) => {
  const h = Number(t.slice(0, 2)), m = t.slice(3, 5);
  return `${((h + 11) % 12) + 1}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};

export async function saveActivity(id: string | null, a: { name: string; place: string; durationMin: number; description: string }) {
  if (id) {
    await getPool().query('update activities set name = $2, place = $3, duration_min = $4, description = $5 where id = $1', [id, a.name, a.place, a.durationMin, a.description]);
    return id;
  }
  const r = await getPool().query<{ id: string }>(
    `insert into activities (name, place, duration_min, description, sort_order)
     values ($1, $2, $3, $4, coalesce((select max(sort_order) + 1 from activities), 1)) returning id`,
    [a.name, a.place, a.durationMin, a.description],
  );
  return r.rows[0].id;
}
