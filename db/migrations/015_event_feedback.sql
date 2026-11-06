-- Feedback on the whole weekend (/feedback): one row per form sent. Anyone can send it; when the browser
-- is signed in as one person, person_id links it to them. Scores are 1–5; "transition" (time to get to
-- the next activity) can be blank for people who did only one activity.
create table event_feedback (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid references people(id) on delete set null,
  name          text not null,
  email         text not null,
  lang          text not null default 'zh',
  activity_ids  uuid[] not null default '{}',
  relax         int not null check (relax between 1 and 5),       -- relax, be present, more self-aware
  venue         int not null check (venue between 1 and 5),       -- venues helped settle the mind
  guidance      int not null check (guidance between 1 and 5),    -- easy to follow the instructor
  transition    int check (transition between 1 and 5),           -- enough time to get to the next activity
  again         int not null check (again between 1 and 5),       -- would do the activities again
  comment       text not null default '',
  ip_hash       text not null default '',
  created_at    timestamptz not null default now()
);
create index event_feedback_created_idx on event_feedback (created_at);
