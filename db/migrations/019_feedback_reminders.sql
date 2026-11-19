-- Second round of the feedback email: a last-day reminder (/staff/feedback-email?round=reminder).
-- Pasted "already gave feedback" addresses move to their own table so they apply to both rounds
-- (in feedback_invites a pasted address could not be recorded once the invitation had been sent).
create table feedback_skips (
  email text primary key,               -- lower-case
  at    timestamptz not null default now()
);
insert into feedback_skips (email, at) select email, at from feedback_invites where status = 'skipped';
delete from feedback_invites where status = 'skipped';

create table feedback_reminders (
  email     text primary key,           -- lower-case; one reminder per address
  names     text not null default '',
  lang      text,
  resend_id text,
  at        timestamptz not null default now()
);
