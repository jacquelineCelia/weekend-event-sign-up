'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { startLoginAction, verifyLoginAction, type LoginState } from '../actions';
import { Leaf } from '@/components/icons';

const Bubble = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

export function AskForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(startLoginAction, null);
  return (
    <form action={action} className="pad stack" style={{ gap: 18, padding: '20px 20px 24px' }}>
      <span className="leafmark" style={{ width: 52, height: 52 }}><Leaf size={26} /></span>
      <h1 className="h1" style={{ fontSize: 31 }}>Welcome back</h1>
      <p className="lede">Enter the phone number or email you signed up with. We&apos;ll send a 6-digit code — no password needed.</p>
      <div className="field">
        <label htmlFor="who">Phone or email</label>
        <input id="who" name="who" className="input" style={{ minHeight: 54, fontSize: 17 }} autoComplete="email tel"
          defaultValue={state?.value ?? ''} aria-invalid={!!state?.error} aria-describedby={state?.error ? 'who-err' : undefined} required />
        {state?.error ? <span id="who-err" className="error">{state.error}</span> : null}
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send me a code'}</button>
      <div className="panel" style={{ fontSize: 14, color: 'var(--ink-2)', padding: '14px 18px', borderRadius: 20 }}>
        Signed up on this phone before? You&apos;ll skip this step — we remember you for the weekend.
      </div>
    </form>
  );
}

export function CodeForm({ ticket, to, via }: { ticket: string; to: string; via: 'sms' | 'email' }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(verifyLoginAction.bind(null, ticket), null);
  return (
    <form action={action} className="pad stack" style={{ gap: 18, padding: '20px 20px 24px' }}>
      <span className="leafmark" style={{ width: 52, height: 52 }}><Bubble /></span>
      <h1 className="h1" style={{ fontSize: 31 }}>{via === 'sms' ? 'Check your texts' : 'Check your email'}</h1>
      <p className="lede">
        {/ and |addresses/.test(to)
          ? <>We&apos;ve sent the same code to {to}. Use whichever arrives first — it expires in 10 minutes.</>
          : <>If {to || 'that'} is on our list, we&apos;ve sent a code. It expires in 10 minutes.</>}
      </p>
      <div className="field">
        <label htmlFor="code">6-digit code</label>
        <input id="code" name="code" className="input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7}
          style={{ minHeight: 60, fontFamily: 'var(--serif)', fontSize: 28, letterSpacing: '0.4em', textAlign: 'center' }}
          aria-invalid={!!state?.error} aria-describedby={state?.error ? 'code-err' : undefined} autoFocus required />
        {state?.error ? <span id="code-err" className="error" role="alert">{state.error}</span> : null}
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Checking…' : 'Show my sign-ups'}</button>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Link href="/me/sign-in" style={{ fontSize: 14, fontWeight: 600, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          Use a different number or email
        </Link>
        <Link href="/me/sign-in" style={{ fontSize: 14, fontWeight: 600, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          Resend code
        </Link>
      </div>
    </form>
  );
}
