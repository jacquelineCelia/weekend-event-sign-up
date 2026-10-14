'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { cancelAction, rateAction } from './actions';
import { Leaf } from '@/components/icons';
import { dict, type Lang } from '@/lib/i18n';

const small = { minHeight: 42, fontSize: 14, padding: '0 14px' } as const;

function Pending({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return <button {...rest} disabled={pending || rest.disabled}>{children}</button>;
}

/** Cancel asks once before releasing the spots. */
export function CancelButton({ lang, bookingId }: { lang: Lang; bookingId: string }) {
  const t = dict(lang);
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="btn ghost" style={{ ...small, color: 'var(--ochre)' }} onClick={() => setAsking(true)}>{t.cancel}</button>
    );
  }
  return (
    <form action={cancelAction} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{t.releaseQ}</span>
      <Pending type="submit" className="btn" style={{ ...small, background: 'var(--ochre)' }}>{t.yesCancel}</Pending>
      <button type="button" className="btn ghost" style={small} onClick={() => setAsking(false)}>{t.keepIt}</button>
    </form>
  );
}

/** 1–10 rating once an activity has finished. */
export function RatePicker({ lang, bookingId, name, score }: { lang: Lang; bookingId: string; name: string; score: number | null }) {
  const t = dict(lang);
  const [open, setOpen] = useState(false);
  if (score && !open) {
    return (
      <div role="status" style={{ paddingLeft: 88, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13.5, color: 'var(--moss-dark)' }}>
        <span style={{ background: 'var(--sage)', padding: '6px 12px', borderRadius: 999, fontWeight: 600 }}>{t.rated(score)}</span>
        <span>{t.thanks}</span>
        <button type="button" onClick={() => setOpen(true)} style={{ border: 0, background: 'transparent', color: 'var(--moss)', fontWeight: 700, cursor: 'pointer', minHeight: 36 }}>{t.change}</button>
      </div>
    );
  }
  if (!open) {
    return (
      <div style={{ paddingLeft: 88 }}>
        <button type="button" className="btn ghost" style={{ ...small, minHeight: 40, color: 'var(--moss-dark)' }} onClick={() => setOpen(true)}>
          <Leaf /> {t.rateThis}
        </button>
      </div>
    );
  }
  return (
    <form action={async (f) => { await rateAction(f); setOpen(false); }} style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)', padding: 0, marginBottom: 8 }}>{t.howWas(name)}</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Pending key={n} type="submit" name="score" value={n} aria-label={t.rateAria(n)}
              style={{ minHeight: 44, borderRadius: 999, border: `1px solid ${n === score ? 'var(--moss)' : 'var(--line-strong)'}`, background: n === score ? 'var(--sage)' : 'var(--paper)', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              {n}
            </Pending>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          <span>{t.notForMe}</span><span>{t.lovedIt}</span>
        </div>
      </fieldset>
      <button type="button" onClick={() => setOpen(false)} style={{ border: 0, background: 'transparent', color: 'var(--muted)', fontWeight: 600, fontSize: 13, minHeight: 36, padding: 0, cursor: 'pointer' }}>{t.later}</button>
    </form>
  );
}
