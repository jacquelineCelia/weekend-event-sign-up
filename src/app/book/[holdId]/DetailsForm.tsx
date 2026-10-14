'use client';

import { useActionState, useEffect, useState } from 'react';
import { changeTimeAction, confirmAction, type FormState } from '@/app/actions';
import { Back, Clock } from '@/components/icons';
import { dict, errorText, type Lang } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';

type Props = {
  lang: Lang;
  holdId: string;
  expiresAt: string;
  summary: { activity: string; when: string; spots: string; partySize: number };
  known: { name: string; first: string; email: string; phone: string } | null;
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

export default function DetailsForm({ lang, holdId, expiresAt, summary, known }: Props) {
  const t = dict(lang);
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
        <form className="side" action={changeTimeAction.bind(null, holdId)}>
          <button className="back" type="submit" style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><Back /> <span className="lbl-s">{t.back}</span></button>
        </form>
        <LangToggle lang={lang} />
        <span className="side end" />
      </div>

      <section className="pad stack" style={{ gap: 14, padding: '8px 20px 20px' }}>
        {left !== null ? (
          <span className="timer" role="timer" data-late={left === 0} style={{ alignSelf: 'flex-start' }}>
            <Clock /> {left > 0 ? t.heldFor(mmss) : t.holdEndedShort}
          </span>
        ) : null}
        <h1 className="h1" style={{ fontSize: 30 }}>{known ? t.welcomeBack(known.first) : t.almostThere}</h1>
        <div className="summary">
          <div className="stack" style={{ gap: 4 }}>
            <span className="serif" style={{ fontSize: 19 }}>{summary.activity}</span>
            <span className="sub">{summary.when}</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{summary.spots}</span>
          </div>
          <form action={changeTimeAction.bind(null, holdId)}>
            <button className="change" type="submit" style={{ background: 'transparent', color: 'var(--on-dark)', fontSize: 14, fontWeight: 600, minHeight: 44, padding: '0 14px', border: '1px solid #5c7a63', borderRadius: 999, cursor: 'pointer' }}>{t.change}</button>
          </form>
        </div>
      </section>

      <form action={action} noValidate style={{ display: 'contents' }}>
        <div className="pad stack" style={{ gap: 18, paddingBottom: 20 }}>
          <Field id="name" label={t.fullName} autoComplete="name" defaultValue={v.name} error={err.name && errorText(lang, err.name)} />
          <Field id="email" label={t.email} type="email" inputMode="email" autoComplete="email" defaultValue={v.email} error={err.email && errorText(lang, err.email)}
            hint={t.emailHint} />
          <Field id="phone" label={t.phone} type="tel" inputMode="tel" autoComplete="tel" defaultValue={v.phone} error={err.phone && errorText(lang, err.phone)}
            hint={t.phoneHint} />

          <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <legend className="legend" style={{ padding: 0, marginBottom: 8 }}>{t.remindLegend}</legend>
            <div className="stack" style={{ border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 20, padding: '10px 18px', gap: 4 }}>
              <label className="check"><input type="checkbox" name="remindSms" checked={sms} onChange={(e) => setSms(e.target.checked)} /> {t.bySms}</label>
              <label className="check"><input type="checkbox" name="remindEmail" checked={mail} onChange={(e) => setMail(e.target.checked)} /> {t.byEmail}</label>
              {!sms && !mail ? <span className="note" role="status" style={{ fontSize: 13, padding: '9px 12px', borderRadius: 12 }}>{t.noReminderWarn}</span> : null}
            </div>
          </fieldset>

          <label className="check" style={{ alignItems: 'flex-start', fontSize: 14, color: 'var(--ink-2)' }}>
            <input type="checkbox" name="remember" defaultChecked /> {t.rememberMe}
          </label>
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
