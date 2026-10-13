-- Core schema for the weekend activities sign-up app.
-- Plain Postgres: runs locally and on Supabase unchanged.

create extension if not exists pgcrypto;

create table activities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  place         text not null,
  description   text not null default '',
  duration_min  int  not null check (duration_min > 0),
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

create table slots (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references activities(id) on delete cascade,
  starts_at    timestamptz not null,
  capacity     int not null check (capacity >= 0),
  created_at   timestamptz not null default now(),
  unique (activity_id, starts_at) deferrable initially deferred
);
create index slots_starts_at_idx on slots (starts_at);

-- One row per attendee, matched by phone (normalised to E.164) or email.
create table people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  created_at  timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create unique index people_phone_idx on people (phone) where phone is not null;
create unique index people_email_idx on people (lower(email)) where email is not null;

-- A booking starts as a 10-minute hold (no person yet) and becomes confirmed.
create type booking_status as enum ('held', 'confirmed', 'cancelled');
create type booking_source as enum ('online', 'walk_in');

create table bookings (
  id               uuid primary key default gen_random_uuid(),
  slot_id          uuid not null references slots(id) on delete restrict,
  person_id        uuid references people(id),
  party_size       int  not null check (party_size between 1 and 50),
  status           booking_status not null default 'held',
  source           booking_source not null default 'online',
  hold_expires_at  timestamptz,
  code             text unique,
  remind_sms       boolean not null default true,
  remind_email     boolean not null default true,
  reminder_sent_at timestamptz,
  checked_in       int not null default 0 check (checked_in >= 0),
  created_at       timestamptz not null default now(),
  confirmed_at     timestamptz,
  cancelled_at     timestamptz,
  check (checked_in <= party_size),
  check (status <> 'confirmed' or (person_id is not null and code is not null)),
  check (status <> 'held' or hold_expires_at is not null)
);
create index bookings_slot_idx on bookings (slot_id) where status <> 'cancelled';
create index bookings_person_idx on bookings (person_id);
create index bookings_reminder_idx on bookings (slot_id) where status = 'confirmed' and reminder_sent_at is null;

create table ratings (
  booking_id  uuid primary key references bookings(id) on delete cascade,
  score       int not null check (score between 1 and 10),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Spots taken in a slot = confirmed bookings + holds that have not expired.
create view slot_availability as
select
  s.id as slot_id,
  s.activity_id,
  s.starts_at,
  s.capacity,
  coalesce(sum(b.party_size) filter (
    where b.status = 'confirmed'
       or (b.status = 'held' and b.hold_expires_at > now())
  ), 0)::int as taken,
  coalesce(sum(b.party_size) filter (where b.status = 'confirmed'), 0)::int as booked,
  greatest(
    s.capacity - coalesce(sum(b.party_size) filter (
      where b.status = 'confirmed'
         or (b.status = 'held' and b.hold_expires_at > now())
    ), 0), 0
  )::int as remaining
from slots s
left join bookings b on b.slot_id = s.id
group by s.id;
