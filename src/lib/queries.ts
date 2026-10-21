import { getPool } from './db';
import { EVENT, type Lang } from './event';
import { localText, toSimplified } from './hans';

export type SlotView = { id: string; startsAt: Date; capacity: number; remaining: number; booked: number };
export type ActivityView = { id: string; name: string; place: string; description: string; durationMin: number; slots: SlotView[] };

type Row = {
  id: string; name: string; place: string; description: string; duration_min: number;
  slot_id: string | null; starts_at: Date | null; capacity: number | null; remaining: number | null; booked: number | null;
};

function group(rows: Row[], lang: Lang = 'en'): ActivityView[] {
  const map = new Map<string, ActivityView>();
  const t = (s: string) => (lang === 'zhs' ? toSimplified(s) : s);
  for (const r of rows) {
    let a = map.get(r.id);
    if (!a) {
      a = { id: r.id, name: t(r.name), place: t(r.place), description: t(r.description), durationMin: r.duration_min, slots: [] };
      map.set(r.id, a);
    }
    if (r.slot_id) a.slots.push({ id: r.slot_id, startsAt: r.starts_at!, capacity: r.capacity!, remaining: r.remaining!, booked: r.booked! });
  }
  return [...map.values()];
}

// Chinese text when there is some (any Chinese $3), otherwise the English. Simplified is converted below.
const SELECT = `
  select a.id,
         case when $3 <> 'en' and a.name_zh <> '' then a.name_zh else a.name end as name,
         case when $3 <> 'en' and a.place_zh <> '' then a.place_zh else a.place end as place,
         case when $3 <> 'en' and a.description_zh <> '' then a.description_zh else a.description end as description,
         a.duration_min,
         v.slot_id, v.starts_at, v.capacity, v.remaining, v.booked
    from activities a
    left join slot_availability v
      on v.activity_id = a.id
     and (v.starts_at at time zone $1)::date = $2::date`;

/** Every activity with its slots on one event day (activities with no slots that day are included, empty). */
export async function activitiesForDay(date: string, lang: Lang = 'en') {
  const { rows } = await getPool().query<Row>(`${SELECT} order by a.sort_order, a.name, v.starts_at`, [EVENT.timeZone, date, lang]);
  return group(rows, lang);
}

export async function activityForDay(id: string, date: string, lang: Lang = 'en') {
  const { rows } = await getPool().query<Row>(`${SELECT} where a.id = $4 order by v.starts_at`, [EVENT.timeZone, date, lang, id]);
  return group(rows, lang)[0] ?? null;
}

export type BookingView = {
  id: string; status: 'held' | 'confirmed' | 'cancelled'; partySize: number; code: string | null;
  holdExpiresAt: Date | null; holdSecondsLeft: number; remindSms: boolean; remindEmail: boolean; personId: string | null;
  personName: string | null; personEmail: string | null; personPhone: string | null; personLang: Lang;
  slotId: string; startsAt: Date; activityId: string; activityName: string; place: string; durationMin: number;
  activityNameZh: string; placeZh: string;
  /** How the party is seated, for activities with seat types (empty otherwise). */
  seats: BookedSeat[];
};

/** One seat type in a sign-up: its names and how many of the party sit there. */
export type BookedSeat = { name: string; nameZh: string; count: number };

/** The seating of several sign-ups at once, by booking id. */
export async function seatsForBookings(ids: string[]): Promise<Map<string, BookedSeat[]>> {
  const out = new Map<string, BookedSeat[]>();
  if (!ids.length) return out;
  const { rows } = await getPool().query<{ booking_id: string; name: string; name_zh: string; count: number }>(
    `select bs.booking_id, st.name, st.name_zh, bs.count
       from booking_seats bs join seat_types st on st.id = bs.seat_type_id
      where bs.booking_id = any($1::uuid[]) order by st.sort_order, st.name`,
    [ids],
  );
  for (const r of rows) {
    const list = out.get(r.booking_id) ?? [];
    list.push({ name: r.name, nameZh: r.name_zh, count: r.count });
    out.set(r.booking_id, list);
  }
  return out;
}

/** An activity's seat types with what's left of each in the given slots (live holds count). */
export type SeatOption = { id: string; name: string; nameZh: string; capacity: number; left: Record<string, number> };

export async function seatOptions(activityId: string, slotIds: string[]): Promise<SeatOption[]> {
  const { rows } = await getPool().query<{ id: string; name: string; name_zh: string; capacity: number; slot_id: string | null; taken: number | null }>(
    `select st.id, st.name, st.name_zh, st.capacity, s.id as slot_id,
            (select coalesce(sum(bs.count), 0)::int from booking_seats bs join bookings b on b.id = bs.booking_id
              where bs.seat_type_id = st.id and b.slot_id = s.id
                and (b.status = 'confirmed' or (b.status = 'held' and b.hold_expires_at > now()))) as taken
       from seat_types st
       left join slots s on s.id = any($2::uuid[])
      where st.activity_id = $1
      order by st.sort_order, st.name`,
    [activityId, slotIds],
  );
  const map = new Map<string, SeatOption>();
  for (const r of rows) {
    let o = map.get(r.id);
    if (!o) map.set(r.id, (o = { id: r.id, name: r.name, nameZh: r.name_zh, capacity: r.capacity, left: {} }));
    if (r.slot_id) o.left[r.slot_id] = Math.max(0, r.capacity - (r.taken ?? 0));
  }
  return [...map.values()];
}

/** The activity's name and place in a language (Chinese when filled in, else English). */
export const bookingText = (b: BookingView, lang: Lang) => ({
  activity: localText(b.activityName, b.activityNameZh, lang),
  place: localText(b.place, b.placeZh, lang),
});

export async function getBooking(id: string): Promise<BookingView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await getPool().query(
    `select b.id, b.status, b.party_size, b.code, b.hold_expires_at,
            greatest(0, floor(extract(epoch from (b.hold_expires_at - clock_timestamp()))))::int as hold_left, b.remind_sms, b.remind_email, b.person_id,
            p.name as person_name, p.email as person_email, p.phone as person_phone, coalesce(p.lang, 'en') as person_lang,
            s.id as slot_id, s.starts_at, a.id as activity_id, a.name as activity_name, a.place, a.duration_min,
            a.name_zh, a.place_zh
       from bookings b
       join slots s on s.id = b.slot_id
       join activities a on a.id = s.activity_id
       left join people p on p.id = b.person_id
      where b.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id, status: r.status, partySize: r.party_size, code: r.code, holdExpiresAt: r.hold_expires_at, holdSecondsLeft: r.hold_left ?? 0,
    remindSms: r.remind_sms, remindEmail: r.remind_email, personId: r.person_id,
    personName: r.person_name, personEmail: r.person_email, personPhone: r.person_phone, personLang: r.person_lang,
    slotId: r.slot_id, startsAt: r.starts_at, activityId: r.activity_id, activityName: r.activity_name,
    place: r.place, durationMin: r.duration_min, activityNameZh: r.name_zh, placeZh: r.place_zh,
    seats: (await seatsForBookings([r.id])).get(r.id) ?? [],
  };
}

export async function getPerson(id: string) {
  const { rows } = await getPool().query<{ id: string; name: string; email: string | null; phone: string | null }>(
    'select id, name, email, phone from people where id = $1',
    [id],
  );
  return rows[0] ?? null;
}
