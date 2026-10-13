# Mindfulness Weekend — activity sign-up

Attendees pick an activity and time, say how many guests they're bringing, and get a check-in code
and a reminder 15 minutes before. Staff check people in and manage times and capacity.

Built with Next.js 16 and Postgres (runs on Supabase as is).

## Status

| Area | State |
| --- | --- |
| Database, capacity-safe booking (holds, confirm, cancel, change time, walk-ins) | Done, tested |
| Attendee flow: browse → pick a time and party size → details → confirmation, calendar file | Done |
| My sign-ups (this device), cancel | Done |
| Sign in from another device with a texted/emailed code | Next |
| Confirmation and 15-minute reminders (email via Resend, text via Twilio) | Next |
| Staff screens: check-in, walk-in, schedule and capacity, staff login | Next |
| Post-activity rating | Next |

## Run it locally

```bash
cp .env.example .env.local        # then set SESSION_SECRET to a long random string
npm install
DATABASE_URL=... node scripts/migrate.mjs --seed   # creates tables + the placeholder schedule
npm run dev
```

Tests run against a real Postgres database (set `TEST_DATABASE_URL`, it is wiped on each run):

```bash
npm test
```

## How double-booking is prevented

Every hold or booking locks its time slot's row, counts confirmed bookings plus unexpired holds,
and only then inserts. Concurrent requests for the last spots queue on that lock, so capacity can't
be exceeded. A hold lasts 10 minutes; if it lapses, confirming re-checks capacity first.
