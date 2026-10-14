-- Several people (a family, a couple) may share one phone number.
-- People are now told apart by email; a phone number is just a way to reach them.
drop index people_phone_idx;
create index people_phone_idx on people (phone) where phone is not null;

-- Signing in with a phone number covers everyone who uses that number,
-- so a sign-in code can belong to a phone number instead of one person.
alter table login_codes alter column person_id drop not null;
alter table login_codes add column phone text;
alter table login_codes add constraint login_codes_target check (person_id is not null or phone is not null);
create index login_codes_phone_idx on login_codes (phone, created_at desc) where phone is not null;
