'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { changeTimeAction, confirmAction, type Conflict, type FormState } from '@/app/actions';
import { Back, Clock } from '@/components/icons';
import { dict, errorText, type Lang, zhBold } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';

type Props = {
  lang: Lang;
  /** smsSender(lang): the event and the organizations behind it, for the texting consent. */
  smsFrom: string;
  holdId: string;
  /** Seconds left on the hold, worked out by the database (so the visitor's clock doesn't matter). */
  secondsLeft: number;
  summary: { activity: string; when: string; spots: string; partySize: number };
  known: { name: string; first: string; email: string; phone: string } | null;
};

/**
 * Counts down from the seconds the server says are left. Uses the browser's monotonic clock
 * (performance.now), not the computer's date and time, so a wrong system clock can't skew it.
 * Updates from the screen-refresh loop and from a backup timer, so one being throttled or
 * blocked (some browser extensions do this) doesn't freeze the display.
 */
export function useCountdown(secondsLeft: number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const compute = () => Math.max(0, Math.ceil(secondsLeft - (performance.now() - start) / 1000));
    let last = -1;
    let frame = 0;
    const update = () => {
      const v = compute();
      if (v !== last) {
        last = v;
        setLeft(v);
      }
    };
    const loop = () => {
      update();
      frame = requestAnimationFrame(loop);
    };
    update();
    frame = requestAnimationFrame(loop);
    const backup = setInterval(update, 500);
    const onShow = () => update();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(backup);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, [secondsLeft]);
  return left;
}

export default function DetailsForm({ lang, smsFrom, holdId, secondsLeft, summary, known }: Props) {
  const t = dict(lang);
  const [state, action, pending] = useActionState<FormState, FormData>(confirmAction.bind(null, holdId), null);
  // Carriers require texting to be opted in to, never pre-ticked.
  const [sms, setSms] = useState(false);
  const [mail, setMail] = useState(true);
  const left = useCountdown(secondsLeft);
  const v = state?.values ?? known ?? { name: '', email: '', phone: '' };
  const err = state?.fields ?? {};
  const mmss = left === null ? '' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <div className="phone">
      <div className="topbar">
        <form action={changeTimeAction.bind(null, holdId)}>
          <button className="back" type="submit" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><Back /> {t.back}</button>
        </form>
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
        <h1 className="h1" style={{ fontSize: 30 }}>{known ? t.welcomeBack(known.first) : t.almostThere}</h1>
        <div className="summary">
          <div className="stack" style={{ gap: 4 }}>
            <span className={`serif${zhBold(summary.activity)}`} style={{ fontSize: 19 }}>{summary.activity}</span>
            <span className="sub">{summary.when}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{summary.spots}</span>
          </div>
          <form action={changeTimeAction.bind(null, holdId)}>
            <button className="change" type="submit" style={{ background: 'transparent', color: 'var(--on-dark)', fontSize: 14, fontWeight: 600, minHeight: 44, padding: '0 14px', border: '1px solid #5c7a63', borderRadius: 999, cursor: 'pointer' }}>{t.change}</button>
          </form>
        </div>
      </section>

      <form action={action} noValidate style={{ display: 'contents' }}>
        {/* Pressing Enter in a field means "confirm", never one of the overlap panel's buttons further down. */}
        <button type="submit" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0, padding: 0 }} />
        <div className="pad stack" style={{ gap: 18, paddingBottom: 20 }}>
          <Field id="name" label={t.fullName} autoComplete="name" defaultValue={v.name} error={err.name && errorText(lang, err.name)} />
          <Field id="email" label={t.email} type="email" inputMode="email" autoComplete="email" defaultValue={v.email} error={err.email && errorText(lang, err.email)}
            hint={t.emailHint} />
          <Field id="phone" label={t.phone} type="tel" inputMode="tel" autoComplete="tel" defaultValue={v.phone} error={err.phone && errorText(lang, err.phone)}
            hint={t.phoneHint} />

          <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="legend" style={{ padding: 0, marginBottom: 8 }}>{t.remindLegend}</legend>
            <div className="stack" style={{ border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 20, padding: '10px 18px', gap: 4 }}>
              <label className="check"><input type="checkbox" name="remindSms" checked={sms} onChange={(e) => setSms(e.target.checked)} aria-describedby="sms-consent" /> {t.bySms}</label>
              <p id="sms-consent" className="consent">
                {t.smsConsent(smsFrom)}{' '}
                <a href="/terms" target="_blank" rel="noopener">{t.terms}</a> · <a href="/privacy" target="_blank" rel="noopener">{t.privacy}</a>
              </p>
              <label className="check"><input type="checkbox" name="remindEmail" checked={mail} onChange={(e) => setMail(e.target.checked)} /> {t.byEmail}</label>
              {!sms && !mail ? <span className="note" role="status" style={{ fontSize: 13, padding: '9px 12px', borderRadius: 12 }}>{t.noReminderWarn}</span> : null}
            </div>
          </fieldset>

          <label className="check" style={{ alignItems: 'flex-start', fontSize: 14, color: 'var(--ink-2)' }}>
            <input type="checkbox" name="remember" defaultChecked /> {t.rememberMe}
          </label>

          {state?.conflict ? <OverlapPanel lang={lang} holdId={holdId} conflict={state.conflict} email={v.email} pending={pending} /> : null}
        </div>

        <div className="footer">
          {state?.error ? <p className="error" role="alert" style={{ margin: 0, textAlign: 'center' }}>{errorText(lang, state.error)}</p> : null}
          <button className="btn" type="submit" disabled={pending}>{pending ? t.confirming : t.confirmBtn(summary.partySize)}</button>
          <small>{t.freeNote}</small>
        </div>
      </form>
    </div>
  );
}

/**
 * Shown when the person already has a sign-up at an overlapping time. Signed in as them: the clashing
 * sign-ups and a button to cancel them and take this one instead. Otherwise: a sign-in code to the
 * email first, so nobody can see or cancel someone else's sign-ups by typing their email.
 * Its buttons submit the details form with an "intent".
 */
function OverlapPanel({ lang, holdId, conflict, email, pending }: { lang: Lang; holdId: string; conflict: Conflict; email: string; pending: boolean }) {
  const t = dict(lang);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [conflict]);
  const keep = (
    <button className="btn ghost" type="submit" formAction={changeTimeAction.bind(null, holdId)} disabled={pending}>{t.keepOld}</button>
  );
  return (
    <div ref={ref} className="note stack" role="alert" style={{ gap: 12, padding: '16px 16px 18px' }}>
      <strong style={{ fontSize: 15.5 }}>{t.overlapTitle}</strong>
      {conflict.owned ? (
        <>
          <p style={{ margin: 0 }}>{t.overlapOwned}</p>
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
            {conflict.items.map((c) => (
              <li key={c.id} className="stack" style={{ gap: 2, background: 'var(--paper)', color: 'var(--ink)', borderRadius: 14, padding: '10px 14px' }}>
                <span className={`serif${zhBold(c.activity)}`} style={{ fontSize: 17 }}>{c.activity}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.when} · {c.place} · {t.spots(c.partySize)}</span>
                <input type="hidden" name="replace" value={c.id} />
              </li>
            ))}
          </ul>
          <button className="btn" type="submit" name="intent" value="replace" disabled={pending}>
            {pending ? t.updating : t.cancelAndSignUp(conflict.items.length)}
          </button>
          {keep}
        </>
      ) : (
        <>
          <p style={{ margin: 0 }}>{t.overlapOther(email)}</p>
          {conflict.ticket ? (
            <>
              <p style={{ margin: 0 }}>{t.codeSentTo(conflict.masked ?? '')}</p>
              <div className="field">
                <label htmlFor="code" style={{ color: 'var(--ink)' }}>{t.codeLabel}</label>
                <input id="code" name="code" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={7}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const f = e.currentTarget.form;
                    const verify = f?.querySelector<HTMLButtonElement>('button[name="intent"][value="verify"]');
                    if (f && verify) f.requestSubmit(verify);
                  }}
                  aria-invalid={!!conflict.codeError} aria-describedby={conflict.codeError ? 'code-err' : undefined} />
                {conflict.codeError ? <span id="code-err" className="error">{errorText(lang, conflict.codeError)}</span> : null}
              </div>
              <button className="btn" type="submit" name="intent" value="verify" disabled={pending}>{pending ? t.checking : t.verifyBtn}</button>
              <button className="btn ghost" type="submit" name="intent" value="send_code" disabled={pending}>{t.resend}</button>
            </>
          ) : (
            <>
              {conflict.codeError ? <span className="error">{errorText(lang, conflict.codeError)}</span> : null}
              <button className="btn" type="submit" name="intent" value="send_code" disabled={pending}>{pending ? t.sending : t.sendCode}</button>
            </>
          )}
          {keep}
        </>
      )}
    </div>
  );
}

function Field(props: {
  id: string; label: string; defaultValue: string; error?: string; hint?: string;
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
