'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { startLoginAction, verifyLoginAction, type LoginState } from '../actions';
import { Leaf } from '@/components/icons';
import { dict, errorText, type Lang } from '@/lib/i18n';

const Bubble = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

/** `codesByText`: the sender's name when sign-in codes can be texted (2FA campaign set up), else null. */
export function AskForm({ lang, codesByText }: { lang: Lang; codesByText: string | null }) {
  const t = dict(lang);
  const [state, action, pending] = useActionState<LoginState, FormData>(startLoginAction, null);
  return (
    <form action={action} className="pad stack" style={{ gap: 18, padding: '20px 20px 24px' }}>
      <span className="leafmark" style={{ width: 52, height: 52 }}><Leaf size={26} /></span>
      <h1 className="h1" style={{ fontSize: 31 }}>{t.welcomeBackTitle}</h1>
      <p className="lede">{t.signinLede}</p>
      <div className="field">
        <label htmlFor="who">{t.phoneOrEmail}</label>
        <input id="who" name="who" className="input" style={{ minHeight: 54, fontSize: 17 }} autoComplete="email tel"
          defaultValue={state?.value ?? ''} aria-invalid={!!state?.error} aria-describedby={state?.error ? 'who-err' : undefined} required />
        {state?.error ? <span id="who-err" className="error">{errorText(lang, state.error)}</span> : null}
        {codesByText ? null : <span className="hint">{t.signinSmsNote} <a href="/terms">{t.terms}</a> · <a href="/privacy">{t.privacy}</a></span>}
      </div>
      <button className="btn" type="submit" disabled={pending} aria-describedby={codesByText ? 'code-consent' : undefined}>{pending ? t.sending : t.sendCode}</button>
      {codesByText ? (
        <p id="code-consent" className="consent" style={{ margin: '-6px 0 0' }}>
          {t.codeTextConsent(codesByText)} <a href="/terms">{t.terms}</a> · <a href="/privacy">{t.privacy}</a>
        </p>
      ) : null}
      <div className="panel" style={{ fontSize: 14, color: 'var(--ink-2)', padding: '14px 18px', borderRadius: 20 }}>
        {t.rememberNote}
      </div>
    </form>
  );
}

export function CodeForm({ lang, ticket, to, many, via }: { lang: Lang; ticket: string; to: string; many: boolean; via: 'sms' | 'email' }) {
  const t = dict(lang);
  const [state, action, pending] = useActionState<LoginState, FormData>(verifyLoginAction.bind(null, ticket), null);
  return (
    <form action={action} className="pad stack" style={{ gap: 18, padding: '20px 20px 24px' }}>
      <span className="leafmark" style={{ width: 52, height: 52 }}><Bubble /></span>
      <h1 className="h1" style={{ fontSize: 31 }}>{via === 'sms' ? t.checkTexts : t.checkEmail}</h1>
      <p className="lede">
        {many ? t.sentMany(to) : t.sentIf(to)}
      </p>
      <div className="field">
        <label htmlFor="code">{t.codeLabel}</label>
        <input id="code" name="code" className="input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7}
          style={{ minHeight: 60, fontFamily: 'var(--serif)', fontSize: 28, letterSpacing: '0.4em', textAlign: 'center' }}
          aria-invalid={!!state?.error} aria-describedby={state?.error ? 'code-err' : undefined} autoFocus required />
        {state?.error ? <span id="code-err" className="error" role="alert">{errorText(lang, state.error)}</span> : null}
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? t.checking : t.showMine}</button>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Link href="/me/sign-in" style={{ fontSize: 14, fontWeight: 600, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          {t.differentWho}
        </Link>
        <Link href="/me/sign-in" style={{ fontSize: 14, fontWeight: 600, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          {t.resend}
        </Link>
      </div>
    </form>
  );
}
