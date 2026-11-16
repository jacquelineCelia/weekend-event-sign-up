-- One-time email inviting everyone who signed up to fill in the feedback form (/staff/feedback-email).
-- One row per email address: 'sent' once the invitation went out (never sent twice), or 'skipped'
-- when staff pasted the address as someone who already gave feedback.
create table feedback_invites (
  email     text primary key,              -- lower-case
  status    text not null check (status in ('sent', 'skipped')),
  names     text not null default '',
  lang      text,
  resend_id text,
  at        timestamptz not null default now()
);
