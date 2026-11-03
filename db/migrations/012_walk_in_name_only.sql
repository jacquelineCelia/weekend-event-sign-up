-- Walk-ins can be signed up with just a name: phone and email are both optional at the desk.
-- (Online sign-ups still need both; that's checked in the app.)
alter table people drop constraint if exists people_check;
