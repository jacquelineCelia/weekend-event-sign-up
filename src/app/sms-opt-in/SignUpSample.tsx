'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Back, Bell, Clock, Sprout } from '@/components/icons';
import LangToggle from '@/components/LangToggle';
import { contactSchema } from '@/lib/contact';
import { dict, errorText, firstName, type Lang, zhBold } from '@/lib/i18n';
import { useCountdown } from '@/app/book/[holdId]/DetailsForm';
import { nameRuns } from '@/components/ActivityName';

type Props = {
  lang: Lang;
  smsFrom: string;
  eventName: string;
  summary: { activity: string; when: string; spots: string; partySize: number };
  ticket: { day: string; time: string; remindAt: string };
  calendar: { title: string; place: string; start: string; end: string };
};

// Same alphabet as real check-in codes (no 0/O or 1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');

type Done = { first: string; email: string; code: string; how: 'sms' | 'email' | 'both' | null };

/** The sign-up details page with the activity already picked; Confirm shows the success page. */
export default function SignUpSample({ lang, smsFrom, eventName, summary, ticket, calendar }: Props) {
  const t = dict(lang);
  // Carriers require texting to be opted in to, never pre-ticked.
  const [sms, setSms] = useState(false);
  const [mail, setMail] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const left = useCountdown(600);
  const mmss = left === null ? '' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = contactSchema.safeParse({ name: String(f.get('name') ?? ''), email: String(f.get('email') ?? ''), phone: String(f.get('phone') ?? '') });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[String(i.path[0])] ??= i.message;
      setErrors(fields);
      return;
    }
    setErrors({});
    setPending(true);
    setTimeout(() => {
      setDone({ first: firstName(parsed.data.name), email: parsed.data.email ?? '', code: makeCode(), how: sms && mail ? 'both' : sms ? 'sms' : mail ? 'email' : null });
      setPending(false);
      window.scrollTo(0, 0);
    }, 600);
  }

  if (done) return <Success lang={lang} done={done} summary={summary} ticket={ticket} calendar={calendar} />;

  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href="/"><Back /> {t.back}</Link>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {left !== null ? (
            <span className="timer" role="timer" data-late={left === 0}>
              <Clock /> {left > 0 ? t.heldFor(mmss) : t.holdEndedShort}
            </span>
          ) : null}
          <LangToggle lang={lang} />
        </span>
      </div>

      <section className="pad stack" style={{ gap: 14, padding: '8px 20px 20px' }}>
        <h1 className="h1" style={{ fontSize: 30 }}>{t.almostThere}</h1>
        <div className="summary">
          <div className="stack" style={{ gap: 4 }}>
            <span className={`serif${zhBold(summary.activity)}`} style={{ fontSize: 19 }}>{nameRuns(summary.activity)}</span>
            <span className="sub">{summary.when}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{summary.spots}</span>
          </div>
          <Link href="/" className="change" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--on-dark)', fontSize: 14, fontWeight: 600, minHeight: 44, padding: '0 14px', border: '1px solid #5c7a63', borderRadius: 999, textDecoration: 'none' }}>{t.change}</Link>
        </div>
      </section>

      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div className="pad stack" style={{ gap: 18, paddingBottom: 20 }}>
          <Field id="name" label={t.fullName} autoComplete="name" error={errors.name && errorText(lang, errors.name)} />
          <Field id="email" label={t.email} type="email" inputMode="email" autoComplete="email" error={errors.email && errorText(lang, errors.email)} hint={t.emailHint} />
          <Field id="phone" label={t.phone} type="tel" inputMode="tel" autoComplete="tel" error={errors.phone && errorText(lang, errors.phone)} hint={t.phoneHint} />

          <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="legend" style={{ padding: 0, marginBottom: 8 }}>{t.remindLegend}</legend>
            <div className="stack" style={{ border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 20, padding: '10px 18px', gap: 4 }}>
              <label className="check"><input type="checkbox" name="remindSms" checked={sms} onChange={(e) => setSms(e.target.checked)} aria-describedby="sms-consent" /> {t.bySms}</label>
              <p id="sms-consent" className="consent">
                {t.smsConsent(smsFrom, eventName)}{' '}
                <a href="/terms" target="_blank" rel="noopener">{t.terms}</a> · <a href="/privacy" target="_blank" rel="noopener">{t.privacy}</a>
              </p>
              <label className="check"><input type="checkbox" name="remindEmail" checked={mail} onChange={(e) => setMail(e.target.checked)} /> {t.byEmail}</label>
              {!sms && !mail ? <span className="note" role="status" style={{ fontSize: 13, padding: '9px 12px', borderRadius: 12 }}>{t.noReminderWarn}</span> : null}
            </div>
          </fieldset>

          <label className="check" style={{ alignItems: 'flex-start', fontSize: 14, color: 'var(--ink-2)' }}>
            <input type="checkbox" name="remember" defaultChecked /> {t.rememberMe}
          </label>
        </div>

        <div className="footer">
          <button className="btn" type="submit" disabled={pending}>{pending ? t.confirming : t.confirmBtn(summary.partySize)}</button>
          <small>{t.freeNote}</small>
        </div>
      </form>
    </div>
  );
}

const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

function Success({ lang, done, summary, ticket, calendar }: { lang: Lang; done: Done; summary: Props['summary']; ticket: Props['ticket']; calendar: Props['calendar'] }) {
  const t = dict(lang);

  function downloadCalendar() {
    const description =
      lang === 'zh' ? `1 位。報到代碼 ${done.code}。` : lang === 'zhs' ? `1 位。签到码 ${done.code}。` : `1 spot. Check-in code ${done.code}.`;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mindfulness Weekend//Signup//EN', 'BEGIN:VEVENT',
      `UID:${done.code}-${stamp(calendar.start)}@signup`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(calendar.start)}`, `DTEND:${stamp(calendar.end)}`,
      `SUMMARY:${icsEsc(calendar.title)}`, `LOCATION:${icsEsc(calendar.place)}`, `DESCRIPTION:${icsEsc(description)}`,
      'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(calendar.title)}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'activity.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="phone">
      <div className="topbar" style={{ justifyContent: 'flex-end' }}><LangToggle lang={lang} /></div>
      <div className="pad stack" style={{ gap: 24, padding: '12px 20px 28px' }}>
        <div className="stack" style={{ gap: 14, alignItems: 'flex-start' }}>
          <span className="leafmark"><Sprout /></span>
          <h1 className="h1" style={{ fontSize: 34 }}>{t.youreIn(done.first)}</h1>
          <p className="lede">{t.allSet}{done.email ? t.confirmationTo(done.email) : ''}</p>
        </div>

        <article className="ticket">
          <div className="top">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--moss)' }}>{ticket.day}</span>
            <span className={`serif${zhBold(summary.activity)}`} style={{ fontSize: 24 }}>{nameRuns(summary.activity)}</span>
            <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>{ticket.time}</span>
          </div>
          <div className="mid">
            <div className="stack" style={{ gap: 2 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{t.party}</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{t.spots(summary.partySize)}</span>
            </div>
            <div className="stack" style={{ gap: 2 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{t.checkInCode}</span>
              <span className="code">{done.code}</span>
            </div>
          </div>
          <div className="bottom">
            <Bell />
            <span>{done.how ? t.remindWill(done.how, ticket.remindAt) : t.noReminderChosen}</span>
          </div>
        </article>

        <div className="stack" style={{ gap: 10 }}>
          <Link className="btn" href="/">{t.another}</Link>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Link className="btn ghost" href="/me">{t.mySignups}</Link>
            <button className="btn ghost" type="button" onClick={downloadCalendar}>{t.addToCalendar}</button>
          </div>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{t.doorNote}</p>
      </div>
    </div>
  );
}

function Field(props: {
  id: string; label: string; error?: string; hint?: string;
  type?: string; inputMode?: 'email' | 'tel'; autoComplete: string;
}) {
  const { id, label, error, hint, ...rest } = props;
  const described = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} className="input" aria-invalid={!!error} aria-describedby={described} required {...rest} />
      {error ? <span id={`${id}-err`} className="error">{error}</span> : null}
      {hint ? <span id={`${id}-hint`} className="hint">{hint}</span> : null}
    </div>
  );
}
