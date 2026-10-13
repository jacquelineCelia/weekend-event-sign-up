-- One-time sign-in codes for "Find your sign-ups" on another device.
create table login_codes (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references people(id) on delete cascade,
  code_hash   text not null,
  sent_via    text not null check (sent_via in ('email', 'sms')),
  attempts    int  not null default 0,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index login_codes_person_idx on login_codes (person_id, created_at desc);
