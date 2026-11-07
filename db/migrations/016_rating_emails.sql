-- "How was it?" emails: after an activity ends, each checked-in sign-up with an email gets one email
-- with a link to rate it. This records when it went out, so it's sent once.
alter table bookings add column rate_email_sent_at timestamptz;
