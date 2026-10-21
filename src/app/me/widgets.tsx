'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { cancelAction, changeSeatsAction, rateAction, type ChangeState } from './actions';
import { Leaf, Minus, Plus } from '@/components/icons';
import { dict, errorText, type Lang } from '@/lib/i18n';

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
      <div role="status" style={{ paddingLeft: 102, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13.5, color: 'var(--moss-dark)' }}>
        <span style={{ background: 'var(--sage)', padding: '6px 12px', borderRadius: 999, fontWeight: 600 }}>{t.rated(score)}</span>
        <span>{t.thanks}</span>
        <button type="button" onClick={() => setOpen(true)} style={{ border: 0, background: 'transparent', color: 'var(--moss)', fontWeight: 700, cursor: 'pointer', minHeight: 36 }}>{t.change}</button>
      </div>
    );
  }
  if (!open) {
    return (
      <div style={{ paddingLeft: 102 }}>
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

/** A seat type this sign-up can use: what's free at its time (its own seats included) and how many it has now. */
export type SeatChoice = { id: string; name: string; free: number; count: number };

/**
 * "Change seating": a button that opens seat steppers for the same party at the same time.
 * Saves only when everyone has a seat and something changed.
 */
export function SeatChanger({ lang, bookingId, party, choices }: { lang: Lang; bookingId: string; party: number; choices: SeatChoice[] }) {
  const t = dict(lang);
  const [open, setOpen] = useState(false);
  const start = Object.fromEntries(choices.map((x) => [x.id, x.count]));
  const [count, setCount] = useState<Record<string, number>>(start);
  const [state, action, pending] = useActionState<ChangeState, FormData>(changeSeatsAction.bind(null, bookingId), null);
  if (!open) {
    return <button type="button" className="btn ghost" style={small} onClick={() => { setCount(start); setOpen(true); }}>{t.changeSeating}</button>;
  }
  const seated = choices.reduce((n, x) => n + (count[x.id] ?? 0), 0);
  const changed = choices.some((x) => (count[x.id] ?? 0) !== x.count);
  return (
    <form action={action} className="stack" role="group" aria-labelledby={`seat-h-${bookingId}`}
      style={{ flexBasis: 'calc(100% + 102px)', marginLeft: -102, order: 1, gap: 10, border: '1px solid var(--line)', borderRadius: 16, padding: '12px 14px', background: 'var(--ground)' }}>
      <span id={`seat-h-${bookingId}`} style={{ fontSize: 14, fontWeight: 600 }}>{t.changeSeating} · <span style={{ fontWeight: 500, color: seated === party ? 'var(--moss-dark)' : 'var(--ochre-dark)' }}>{t.seatsChosen(seated, party)}</span></span>
      {choices.map((x) => {
        const n = count[x.id] ?? 0;
        return (
          <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600 }} id={`seat-${bookingId}-${x.id}`}>{x.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{x.free === 0 ? t.full : t.left(x.free)}</span>
            </div>
            <div className="stepper" role="group" aria-labelledby={`seat-${bookingId}-${x.id}`}>
              <button type="button" className="round" aria-label={t.removeSeat(x.name)} disabled={n <= 0} onClick={() => setCount({ ...count, [x.id]: n - 1 })}><Minus /></button>
              <output aria-live="polite">{n}</output>
              <button type="button" className="round" aria-label={t.addSeat(x.name)} disabled={n >= x.free || seated >= party} onClick={() => setCount({ ...count, [x.id]: n + 1 })}><Plus /></button>
            </div>
          </div>
        );
      })}
      <input type="hidden" name="seats" value={JSON.stringify(choices.map((x) => ({ seatTypeId: x.id, count: count[x.id] ?? 0 })).filter((x) => x.count > 0))} />
      {state?.error ? <p className="error" role="alert" style={{ margin: 0 }}>{errorText(lang, state.error)}</p> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" className="btn" style={small} disabled={pending || seated !== party || !changed}>
          {pending ? t.savingSeating : seated !== party ? t.moreSeats(party - seated) : t.saveSeating}
        </button>
        <button type="button" className="btn ghost" style={small} onClick={() => setOpen(false)}>{t.keepIt}</button>
      </div>
    </form>
  );
}
