-- Seating options for an activity (e.g. Tea Ceremony: "High chair" and "Ground seat").
-- Each type's capacity is the same for every time slot. When an activity has seat types,
-- each slot's capacity is kept equal to their total, so the rest of the app keeps working
-- with one number per slot.
create table seat_types (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references activities(id) on delete cascade,
  name         text not null,
  name_zh      text not null default '',
  capacity     int  not null check (capacity >= 0),
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);
create index seat_types_activity_idx on seat_types (activity_id, sort_order);

-- How a sign-up's party is seated (a party can mix types). Rows add up to the party size.
create table booking_seats (
  booking_id    uuid not null references bookings(id) on delete cascade,
  seat_type_id  uuid not null references seat_types(id) on delete restrict,
  count         int  not null check (count > 0),
  primary key (booking_id, seat_type_id)
);
create index booking_seats_type_idx on booking_seats (seat_type_id);
