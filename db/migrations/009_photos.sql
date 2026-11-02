-- Photo showcase: attendees upload a photo on one of nine topics; staff show them on a big screen.
create table photo_topics (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_zh     text not null default '',
  sort_order  int  not null default 0
);

-- Placeholders until the real topics are chosen; rename them by sort_order.
insert into photo_topics (name, name_zh, sort_order)
select 'Topic ' || n, '主題 ' || n, n from generate_series(1, 9) as n;

-- Images are resized in the browser before upload (about 0.5 MB each) and kept in the database,
-- so the feature needs no extra storage service. Removing a photo deletes the row.
create table photos (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references photo_topics(id),
  name        text not null,
  image       bytea not null,
  bytes       int  not null,
  ip_hash     text not null default '',
  created_at  timestamptz not null default now()
);
create index photos_ip_idx on photos (ip_hash, created_at desc);
