'use client';

import { useActionState, useEffect, useState } from 'react';
import { changeTimeAction, confirmAction, type FormState } from '@/app/actions';
import { Back, Clock } from '@/components/icons';

type Props = {
  holdId: string;
  expiresAt: string;
  summary: { activity: string; when: string; spots: string; partySize: number };
  known: { name: string; email: string; phone: string } | null;
};

function useCountdown(iso: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const end = Date.parse(iso);
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  return left;
}

export default function DetailsForm({ holdId, expiresAt, summary, known }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(confirmAction.bind(null, holdId), null);
  const [sms, setSms] = useState(true);
  const [mail, setMail] = useState(true);
  const left = useCountdown(expiresAt);
  const v = state?.values ?? known ?? { name: '', email: '', phone: '' };
  const err = state?.fields ?? {};
  const mmss = left === null ? '' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <div className="phone">
      <div className="topbar">
        <form action={changeTimeAction.bind(null, holdId)}>
          <button className="back" type="submit" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><Back /> Back</button>
        </form>
        {left !== null ? (
          <span className="timer" role="timer" data-late={left === 0}>
            <Clock /> {left > 0 ? `Held for ${mmss}` : 'Hold ended — confirm to try'}
          </span>
        ) : null}
      </div>

      <section className="pad stack" style={{ gap: 14, padding: '8px 20px 20px' }}>
        <h1 className="h1" style={{ fontSize: 30 }}>{known ? `Welcome back, ${known.name.split(' ')[0]}` : 'Almost there'}</h1>
        <div className="summary">
          <div className="stack" style={{ gap: 4 }}>
            <span className="serif" style={{ fontSize: 19 }}>{summary.activity}</span>
            <span className="sub">{summary.when}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{summary.spots}</span>
          </div>
          <form action={changeTimeAction.bind(null, holdId)}>
            <button className="change" type="submit" style={{ background: 'transparent', color: 'var(--on-dark)', fontSize: 14, fontWeight: 600, minHeight: 44, padding: '0 14px', border: '1px solid #5c7a63', borderRadius: 999, cursor: 'pointer' }}>Change</button>
          </form>
        </div>
      </section>

      <form action={action} noValidate style={{ display: 'contents' }}>
        <div className="pad stack" style={{ gap: 18, paddingBottom: 20 }}>
          <Field id="name" label="Full name" autoComplete="name" defaultValue={v.name} error={err.name} />
          <Field id="email" label="Email" type="email" inputMode="email" autoComplete="email" defaultValue={v.email} error={err.email}
            hint="Your confirmation and a link back to your schedule go here." />
          <Field id="phone" label="Mobile phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v.phone} error={err.phone}
            hint="Staff can also find you at check-in by this number." />

          <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="legend" style={{ padding: 0, marginBottom: 8 }}>Remind me 15 minutes before</legend>
            <div className="stack" style={{ border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 20, padding: '10px 18px', gap: 4 }}>
              <label className="check"><input type="checkbox" name="remindSms" checked={sms} onChange={(e) => setSms(e.target.checked)} /> By text message</label>
              <label className="check"><input type="checkbox" name="remindEmail" checked={mail} onChange={(e) => setMail(e.target.checked)} /> By email</label>
              {!sms && !mail ? <span className="note" role="status" style={{ fontSize: 13, padding: '9px 12px', borderRadius: 12 }}>You won&apos;t get a reminder for this activity.</span> : null}
            </div>
          </fieldset>

          <label className="check" style={{ alignItems: 'flex-start', fontSize: 14, color: 'var(--ink-2)' }}>
            <input type="checkbox" name="remember" defaultChecked /> Remember me on this device so my next sign-up is quicker.
          </label>
        </div>

        <div className="footer">
          {state?.error ? <p className="error" role="alert" style={{ margin: 0, textAlign: 'center' }}>{state.error}</p> : null}
          <button className="btn" type="submit" disabled={pending}>{pending ? 'Confirming…' : `Confirm ${summary.spots}`}</button>
          <small>Free · Cancel any time from My sign-ups</small>
        </div>
      </form>
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
