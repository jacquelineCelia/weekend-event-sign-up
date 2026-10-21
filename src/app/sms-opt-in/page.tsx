import type { Metadata } from 'next';
import Link from 'next/link';
import { EVENT } from '@/lib/event';
import { dict } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { Back } from '@/components/icons';
import { smsSender } from '@/lib/hans';
import { LegalFoot } from '@/components/LegalPage';

// Public page for text-message carriers (A2P 10DLC review): how people opt in, with a live sample of the form.
// In English, the language reviewers read.
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
            “By text message (optional)”. Directly beneath it they see:
            <blockquote className="quote">
              {dict('en').smsConsent(smsSender('en'))} <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
            </blockquote>
          </li>
          <li>We text the attendee only if they tick that box themselves. Booking works whether or not they do.</li>
        </ol>
        <p>
          Here is that part of the sign-up form, exactly as it appears on the details page (this sample doesn’t submit;
          the real form is reached by picking an activity and time on the home page):
        </p>
        <form className="sample" aria-label="Sample of the sign-up form's contact and text-message consent section">
          <div className="field"><label htmlFor="s-name">Full name</label><input id="s-name" name="name" className="input" autoComplete="off" placeholder="Jane Doe" /></div>
          <div className="field"><label htmlFor="s-email">Email</label><input id="s-email" name="email" type="email" className="input" autoComplete="off" placeholder="jane@example.com" /></div>
          <div className="field">
            <label htmlFor="s-phone">Mobile phone</label>
            <input id="s-phone" name="phone" type="tel" className="input" autoComplete="off" placeholder="(555) 555-0100" aria-describedby="s-phone-hint" />
            <span id="s-phone-hint" className="hint">{dict('en').phoneHint}</span>
          </div>
          <fieldset>
            <legend className="legend">{dict('en').remindLegend}</legend>
            <label className="check"><input type="checkbox" name="sms_consent" value="yes" aria-describedby="s-consent" /> {dict('en').bySms}</label>
            <p id="s-consent" className="consent">
              {dict('en').smsConsent(smsSender('en'))} <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a>
            </p>
            <label className="check"><input type="checkbox" name="email_reminder" defaultChecked /> {dict('en').byEmail}</label>
          </fieldset>
          <button type="button" className="btn" disabled>Confirm 1 spot (sample, doesn’t submit)</button>
        </form>

        <h2>2. What we send</h2>
        <ul>
          <li>Message frequency varies with how many activities someone signs up for, usually 2–3 texts per activity.</li>
          <li>Message and data rates may apply.</li>
          <li>Every text starts with “{event}:”. The first text (the booking confirmation) also says “Msg frequency varies. Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.”</li>
          <li>Reply <b>STOP</b> at any time to stop texts; reply <b>HELP</b> for help, or email <a href={`mailto:${mail}`}>{mail}</a>.</li>
          <li>Phone numbers and text-message consent are never shared with third parties or sold. See our <a href="/privacy">Privacy policy</a> and <a href="/terms">Terms</a>.</li>
        </ul>
      </article>
      <LegalFoot lang={lang} />
    </div>
  );
}
