import type { Metadata } from 'next';
import Link from 'next/link';
import { EVENT } from '@/lib/event';
import { dict } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { Back } from '@/components/icons';
import { LegalFoot } from '@/components/LegalPage';

// Public page for text-message carriers (A2P 10DLC review): how people opt in, with screenshots.
// In English, the language reviewers read. Plain <img> on purpose: two static screenshots.
/* eslint-disable @next/next/no-img-element */
// Screenshots live in public/sms-opt-in/.
export const metadata: Metadata = { title: `How people opt in to texts · ${EVENT.name}` };

export default async function SmsOptIn() {
  const lang = await getLang();
  const t = dict(lang);
  const event = EVENT.name;
  const mail = EVENT.supportEmail;
  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href="/"><Back /> {t.allActivities}</Link>
      </div>
      <article className="legal" lang="en">
        <h1 className="h1" style={{ fontSize: 30, margin: '6px 0 4px' }}>How people opt in to {event} texts</h1>
        <p className="muted" style={{ fontSize: 13 }}>Run by {EVENT.org}, part of {EVENT.parentOrg}</p>
        <p>
          We send text messages only to attendees who agree to them, and only about their own sign-ups: a confirmation,
          a reminder 15 minutes before each activity, a notice if an activity’s start time changes, and one-time sign-in
          codes they request. We never send marketing texts. Texting is optional; attendees can choose email instead.
        </p>

        <h2>1. Signing up on this website</h2>
        <ol>
          <li>On <Link href="/">{process.env.APP_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'the home page'}</Link>, the attendee picks an activity and a time, then taps <b>Continue</b>.</li>
          <li>On the details page they enter their name, email and mobile number.</li>
          <li>
            Under “Remind me 15 minutes before” is a separate checkbox, <b>unchecked by default</b>, labeled
            “By text message”. Directly beneath it they see:
            <blockquote className="quote">
              {dict('en').smsConsent(event)} <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
            </blockquote>
          </li>
          <li>We text the attendee only if they tick that box themselves. Booking works whether or not they do.</li>
        </ol>
        <figure className="shot">
          <img src="/sms-opt-in/sign-up-form.png" alt="The sign-up details page: name, email and mobile phone fields, then an unchecked “By text message” box with the consent wording and Terms and Privacy links beneath it." width={430} height={1035} />
          <figcaption>The details page as attendees see it. The “By text message” box starts unchecked.</figcaption>
        </figure>

        <h2>2. Walk-in guests at the event</h2>
        <p>
          Staff sign up walk-in guests on a staff device. Before ticking the separate <b>“OK to text them”</b> box,
          which is also unchecked by default, staff ask the guest:
        </p>
        <blockquote className="quote">
          “Can we text you a reminder 15 minutes before, and if the time changes? Message and data rates may apply;
          reply STOP any time to stop.”
        </blockquote>
        <p>Staff tick the box only if the guest says yes. Otherwise their reminders go by email.</p>
        <figure className="shot">
          <img src="/sms-opt-in/walk-in-form.png" alt="The staff walk-in form: name, mobile phone and email fields, an unchecked “OK to text them (ask first)” box, and the question staff read to the guest." width={727} height={369} />
          <figcaption>The staff walk-in form, with the unchecked “OK to text them” box and the question staff read.</figcaption>
        </figure>

        <h2>3. What we send</h2>
        <ul>
          <li>Message frequency varies with how many activities someone signs up for, usually 2–3 texts per activity.</li>
          <li>Message and data rates may apply.</li>
          <li>Every text starts with “{event}:” or names {event}. The first text says “Reply STOP to opt out.”</li>
          <li>Reply <b>STOP</b> at any time to stop texts; reply <b>HELP</b> for help, or email <a href={`mailto:${mail}`}>{mail}</a>.</li>
          <li>Phone numbers and text-message consent are never shared with third parties or sold. See our <a href="/privacy">Privacy policy</a> and <a href="/terms">Terms</a>.</li>
        </ul>
      </article>
      <LegalFoot lang={lang} />
    </div>
  );
}
