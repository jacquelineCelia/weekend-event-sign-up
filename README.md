# Mindfulness Weekend — activity sign-up

Attendees pick an activity and time, say how many guests they're bringing, and get a check-in code
and a reminder 15 minutes before. Staff check people in, sign up walk-ins, and manage times and
capacity.

Built with Next.js 16 and Postgres (runs on Supabase as is).

## What's in it

**Attendees** (`/`)
- Browse 13 activities by day, see spots left per time, pick a time and party size.
- Spots are held for 10 minutes while they enter name, email and phone.
- Confirmation page with a check-in code and a calendar file (with a 15-minute alarm).
- **My sign-ups** (`/me`): remembered on the device; on a new device, sign in with a 6-digit code
  sent by text or email. Change time, cancel, and rate finished activities 1–10.
- Confirmation message right away, reminder 15 minutes before each activity.

**Staff** (`/staff`, behind a shared passcode)
- **Check-in**: sessions by day, live roster with search by name, last 4 of phone or code;
  check in a whole party or some of it. Refreshes every 20 seconds.
- **Walk-in sign-up**: any activity and time, over-capacity only with an explicit lead approval,
  optional "check in now".
- **Schedule & capacity**: add, move or delete time slots and change capacity per slot; edit or add
  activities. Capacity can't drop below what's booked, booked slots can't be deleted, overlapping
  slots are blocked, and guests in a moved slot are told the new time.

## Run it locally

```bash
cp .env.example .env.local        # fill in SESSION_SECRET and STAFF_PASSCODE at least
npm install
node --env-file=.env.local scripts/migrate.mjs --seed   # tables + the placeholder schedule
npm run dev
```

Without Resend/Twilio keys, every email and text is printed to the server log instead — handy for
testing (sign-in codes included).

Tests run against a real Postgres database (set `TEST_DATABASE_URL`; it is wiped on each run):

```bash
npm test     # 30 tests: capacity under concurrency, holds, login codes, reminders, schedule edits
```

## Deploy (Vercel + Supabase)

1. **Database** — create a Supabase project. Copy the *Transaction pooler* connection string into
   `DATABASE_URL`, set `DATABASE_SSL=true`, then run
   `node --env-file=.env.production scripts/migrate.mjs --seed` once from your machine.
2. **App** — import the repo in Vercel and set the environment variables from `.env.example`:
   `DATABASE_URL`, `DATABASE_SSL`, `SESSION_SECRET` (32+ random chars), `STAFF_PASSCODE`,
   `APP_URL` (your public URL), `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, and optionally the
   three `TWILIO_*` values for texts.
3. **Email** — in Resend, verify the domain you send from and use it in `EMAIL_FROM`.
4. **Reminders** — something must call `/api/cron/reminders` every minute with
   `Authorization: Bearer $CRON_SECRET`. Vercel's free plan only runs cron once a day, so use
   Supabase's scheduler (SQL editor):

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   select cron.schedule('send-reminders', '* * * * *', $$
     select net.http_post(
       url := 'https://YOUR-APP.vercel.app/api/cron/reminders',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
     );
   $$);
   ```

   Each run sends reminders for activities starting in the next 15 minutes. Runs can overlap
   safely — a booking is claimed before sending, so nobody gets two reminders.
5. **Real activities** — replace the placeholders in **Staff → Schedule & capacity**
   (or edit `db/seed.sql` before seeding).

## How double-booking is prevented

Every hold or booking locks its time slot's row, counts confirmed bookings plus unexpired holds,
and only then inserts. Concurrent requests for the last spots queue on that lock, so capacity can't
be exceeded (tested with 30 simultaneous requests for 10 spots). A hold lasts 10 minutes; if it
lapses, confirming re-checks capacity first. Schedule edits take the same locks.
