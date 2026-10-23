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
- **Seating choices** (e.g. Tea Ceremony: "High chair" and "Ground seat"): staff add seat types,
  each with a capacity that applies to every time slot, under Schedule & capacity → Seating; the
  slot's capacity becomes their total. When attendees say how many are coming they choose a seat for
  each person (a party can mix types). Attendees can change their seating later from My sign-ups (same party,
  same time). Seating shows on the ticket, My sign-ups, the confirmation
  and reminder emails, the staff roster, and the walk-in form.
- **No overlapping sign-ups**: one person (one email) can't sign up for two activities whose times
  overlap (back-to-back is fine). The details screen explains the clash and offers to cancel the
  other sign-up and take this one, in one step, or keep it and pick another time. The clashing
  sign-up is only shown — and can only be cancelled — once the browser is signed in as that person;
  otherwise they're offered a 6-digit code to their email first. People sharing a phone are
  separate, so a family can do things at the same time. The same rule applies when changing time in
  My sign-ups (overlapping times are marked; picking one asks whether to keep the other sign-up or
  cancel it and move) and to staff walk-ins (staff see the
  clash and can cancel it and sign the guest up for the new time).
- **My sign-ups** (`/me`): remembered on the device; on a new device, sign in with a 6-digit code
  sent by email (to every email on a shared phone), or by text when a mobile number is entered and
  `TWILIO_CODES_FROM` is set (see Deploy). Change time, cancel, and rate finished activities 1–10.
- Confirmation message right away, reminder 15 minutes before each activity.
- **Texting follows carrier (A2P 10DLC) rules**: the "By text message" box starts unticked, with the
  consent wording and Terms/Privacy links beside it; only people who tick it get texts (walk-ins
  signed up by staff are never texted); every text starts with "The Oneness Truth Foundation:" (the business registered with
  carriers, and the only sender named in the consent) and the first (the booking confirmation) gives
  message frequency, "Msg & data rates may apply" and "Reply HELP for help, STOP to opt out"; sign-in codes always go by email, never by text, and reminder texts carry no link,
  so every text is an account notification; and
  if someone replies STOP, their reminders switch to email. Terms (`/terms`) and Privacy (`/privacy`)
  pages are in all three languages; set `NEXT_PUBLIC_ORG_NAME` and `NEXT_PUBLIC_SUPPORT_EMAIL`.
- **Map**: a Map button on the Up next card opens a map of the grounds with the next activity's place
  highlighted and what happens where. The map is a **placeholder drawing**: replace the drawing in
  `src/components/VenueMap.tsx` and the pin positions in `src/lib/venue-map.ts` with the real site.
- **Shared phone numbers** (families, couples): people are told apart by email, so several can use
  one phone. Signing in with that phone shows everyone's sign-ups, each labelled with a name;
  signing in with an email shows just that person's. Texts start with the person's first name.
- **Chinese, Traditional (Taiwan wording) and Simplified (mainland wording)**: opens in 繁體中文 on
  phones set to Taiwan/Hong Kong Chinese and in 简体中文 on mainland/Singapore Chinese, with an
  EN | 繁中 | 简中 switch on every screen (switching keeps a half-filled form and the 10-minute hold).
  Shareable links: `yoursite/tw` (or `/zh`) for Traditional, `yoursite/cn` for Simplified, `/en`.
  Each attendee's language is saved, so confirmations, reminders, sign-in codes and time-change
  notices come in it.

**Staff** (`/staff`, behind a shared passcode)
- **Check-in**: sessions by day (with a search box above the list; finished sessions are hidden,
  with a "Show finished" link to look back), live roster with search by name, last 4 of phone or code;
  check in a whole party or some of it. Refreshes every 20 seconds.
- **Walk-in sign-up**: any activity and time that hasn't ended yet, over-capacity only with an explicit lead approval,
  optional "check in now". Walk-ins are never texted; reminders go by email if they give one.
- **Schedule & capacity**: add, move or delete time slots and change capacity per slot; edit or add
  activities. Capacity can't drop below what's booked, booked slots can't be deleted, overlapping
  slots are blocked, and guests in a moved slot are told the new time. Each activity also has
  Chinese name, place and description fields, typed once in Traditional; Simplified readers get them
  converted automatically (OpenCC, character by character). Blank fields show the English, and the
  list marks activities with "中 missing" until they're filled in. Staff screens stay in English; the
  check-in list tags attendees 繁 or 简, and walk-ins can be given either Chinese for their messages.

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
npm test     # 85 tests: capacity, holds, overlaps, seating, login codes, reminders, schedule edits, shared phones, Chinese
```

## Deploy (Vercel + Supabase)

1. **Database** — create a Supabase project. Copy the *Transaction pooler* connection string into
   `DATABASE_URL`, set `DATABASE_SSL=true`, then run
   `node --env-file=.env.production scripts/migrate.mjs --seed` once from your machine.
2. **App** — import the repo in Vercel and set the environment variables from `.env.example`:
   `DATABASE_URL`, `DATABASE_SSL`, `SESSION_SECRET` (32+ random chars), `STAFF_PASSCODE`,
   `APP_URL` (your public URL), `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, and the three
   `TWILIO_*` values for texts.
3. **Email (Resend) and texts (Twilio)**
   - *Email:* in Resend, add your sending domain under Domains and add the DNS records it shows
     (at your DNS host, e.g. Namecheap); wait for it to say Verified. Then create an API key with
     "Sending access" → `RESEND_API_KEY`, and use an address on that domain in `EMAIL_FROM`.
     (SendGrid still works: with `RESEND_API_KEY` empty, a `SENDGRID_API_KEY` is used instead.)
   - *Texts:* in the Twilio console, copy the Account SID and Auth Token, and buy a phone number
     (or create a Messaging Service) → `TWILIO_FROM`. US numbers need A2P 10DLC registration
     before carriers deliver texts reliably, which can take a few days to a couple of weeks —
     start it early. Until it's approved, leave the `TWILIO_*` values unset so everything goes by
     email — Twilio accepts texts from unregistered numbers but carriers silently drop them.
   - *Sign-in codes by text (optional):* these are a second campaign with the **2FA** use case,
     on its own Messaging Service with its own phone number (a number can belong to only one
     campaign) → `TWILIO_CODES_FROM`. Codes are texted only from the My sign-ups sign-in page, when
     a mobile number is entered and the unticked "Text me the code" box (consent wording under it)
     is ticked; everywhere else, and while it's unset, codes go by email.
     While the campaign is under review, set `SHOW_CODE_TEXT_DISCLOSURE=1` so reviewers can see the
     disclosure on `/me/sign-in`; remove it once `TWILIO_CODES_FROM` is set.
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
5. **Preview site (optional)** — push a `dev` branch and Vercel deploys it at a stable address like
   `<project>-git-dev-<you>.vercel.app`. Give Vercel's **Preview** environment the dev database's
   `DATABASE_URL`, its own `SESSION_SECRET` / `STAFF_PASSCODE`, and leave out `APP_URL`,
   `RESEND_API_KEY`, `SENDGRID_API_KEY` and `TWILIO_*` (messages then go to the Vercel logs, and links point at the
   preview). Previews require a Vercel login by default — turn that off under Settings →
   Deployment Protection if testers without Vercel accounts need in.
6. **Real activities** — replace the placeholders in **Staff → Schedule & capacity**
   (or edit `db/seed.sql` before seeding).

## How double-booking is prevented

Every hold or booking locks its time slot's row, counts confirmed bookings plus unexpired holds,
and only then inserts. Concurrent requests for the last spots queue on that lock, so capacity can't
be exceeded (tested with 30 simultaneous requests for 10 spots). A hold lasts 10 minutes; if it
lapses, confirming re-checks capacity first. Schedule edits take the same locks.
