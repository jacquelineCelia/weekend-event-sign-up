'use client';

import { useActionState } from 'react';
import { staffLoginAction } from '../actions';
import { sdict } from '@/lib/staff-i18n';
import type { Lang } from '@/lib/event';

export default function LoginForm({ lang }: { lang: Lang }) {
  const t = sdict(lang);
  const [state, action, pending] = useActionState(staffLoginAction, null);
  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <div className="field">
        <label htmlFor="passcode">{t.passcode}</label>
        <input id="passcode" name="passcode" type="password" className="input" autoComplete="current-password" required
          aria-invalid={!!state?.error} aria-describedby={state?.error ? 'pc-err' : undefined} />
        {state?.error ? <span id="pc-err" className="error" role="alert">{state.error}</span> : null}
      </div>
      <button className="btn" type="submit" disabled={pending}>{pending ? t.checking : t.signIn}</button>
    </form>
  );
}
