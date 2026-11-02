-- Several people (a family, a couple) may share one email address.
-- A person is now an email together with a name; an email alone only says how to reach them.

-- The form of a name used to compare people: ignores case and all spaces (including the
-- full-width Chinese space), so "Anna Park" = "anna  park" and "王小明" = "王 小明".
create function person_name_key(n text) returns text
  language sql immutable parallel safe
  as $$ select lower(regexp_replace(n, '[[:space:]　]+', '', 'g')) $$;

drop index people_email_idx;
create unique index people_email_name_idx on people (lower(email), person_name_key(name)) where email is not null;

-- Signing in with an email covers everyone who uses it, so a sign-in code can belong to an email.
alter table login_codes add column email text;
alter table login_codes drop constraint login_codes_target;
alter table login_codes add constraint login_codes_target check (person_id is not null or phone is not null or email is not null);
create index login_codes_email_idx on login_codes (email, created_at desc) where email is not null;
