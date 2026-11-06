'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { cancelAction, changeSeatsAction, rateAction, type ChangeState } from './actions';
import { Leaf, Minus, Plus } from '@/components/icons';
import { dict, errorText, type Lang } from '@/lib/i18n';

const small = { minHeight: 42, fontSize: 15.5, padding: '0 14px' } as const;

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
      <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>{t.releaseQ}</span>
      <Pending type="submit" className="btn" style={{ ...small, background: 'var(--ochre)' }}>{t.yesCancel}</Pending>
      <button type="button" className="btn ghost" style={small} onClick={() => setAsking(false)}>{t.keepIt}</button>
    </form>
  );
}

/**
 * Two feedback questions once an activity has finished: "slowed down and present?" (1–5) and
 * "would you do it again?" (yes / no). Each tap saves that answer; the panel closes once both are in.
 */
export function RatePicker({ lang, bookingId, calm, again }: { lang: Lang; bookingId: string; calm: number | null; again: boolean | null }) {
  const t = dict(lang);
  const [open, setOpen] = useState(false);
  const answered = calm !== null && again !== null;
  if (answered && !open) {
    return (
      <div role="status" style={{ paddingLeft: 102, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 15, color: 'var(--moss-dark)' }}>
        <span style={{ background: 'var(--sage)', padding: '6px 12px', borderRadius: 999, fontWeight: 600 }}>{t.feedbackSummary(calm, again)}</span>
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
  const save = async (f: FormData) => {
    await rateAction(f);
    // Close once both questions have an answer.
    if ((f.has('calm') || calm !== null) && (f.has('again') || again !== null)) setOpen(false);
  };
  const pill = (on: boolean) => ({ minHeight: 48, borderRadius: 999, border: `1px solid ${on ? 'var(--moss)' : 'var(--line-strong)'}`, background: on ? 'var(--sage)' : 'var(--paper)', fontWeight: 600, fontSize: 17, cursor: 'pointer' });
  const legend = { fontSize: 16, fontWeight: 600, color: 'var(--ink-2)', padding: 0, marginBottom: 10, lineHeight: 1.45 } as const;
  return (
    <form action={save} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'grid', gap: 18 }}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend style={legend}>{t.calmQ}</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pending key={n} type="submit" name="calm" value={n} aria-label={t.calmAria(n)} aria-pressed={n === calm} style={pill(n === calm)}>{n}</Pending>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>
          <span>{t.calmLow}</span><span>{t.calmHigh}</span>
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend style={legend}>{t.againQ}</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <Pending type="submit" name="again" value="yes" aria-pressed={again === true} style={pill(again === true)}>{t.againYes}</Pending>
          <Pending type="submit" name="again" value="no" aria-pressed={again === false} style={pill(again === false)}>{t.againNo}</Pending>
        </div>
      </fieldset>
      <button type="button" onClick={() => setOpen(false)} style={{ justifySelf: 'start', border: 0, background: 'transparent', color: 'var(--muted)', fontWeight: 600, fontSize: 14.5, minHeight: 36, padding: 0, cursor: 'pointer' }}>{t.later}</button>
    </form>
  );
}

/** A seat type this sign-up can use: what's free at its time (its own seats included) and how many it has now. */
export type SeatChoice = { id: string; name: string; free: number; count: number };

/**
 * "Change guests" (or "Change guests or seating", for activities with seating choices): opens a guest
 * stepper, plus seat steppers when there are seat types, for the same time. Lowering the guests takes
 * seats away from the last type chosen; raising them asks for more seats before saving.
 */
export function PartyChanger({ lang, bookingId, party, maxParty, choices }: { lang: Lang; bookingId: string; party: number; maxParty: number; choices: SeatChoice[] }) {
  const t = dict(lang);
  const [open, setOpen] = useState(false);
  const start = Object.fromEntries(choices.map((x) => [x.id, x.count]));
  const [count, setCount] = useState<Record<string, number>>(start);
  const [size, setSize] = useState(party);
  const [state, action, pending] = useActionState<ChangeState, FormData>(changeSeatsAction.bind(null, bookingId), null);
  const label = choices.length ? t.changeGuestsSeating : t.changeGuests;
  if (!open) {
    return <button type="button" className="btn ghost" style={small} onClick={() => { setCount(start); setSize(party); setOpen(true); }}>{label}</button>;
  }
  const seatedIn = (c: Record<string, number>) => choices.reduce((n, x) => n + (c[x.id] ?? 0), 0);
  const seated = seatedIn(count);
  const needSeats = choices.length > 0 && seated !== size;
  const changed = size !== party || choices.some((x) => (count[x.id] ?? 0) !== x.count);
  const lower = () => {
    const next = size - 1;
    setSize(next);
    let extra = seatedIn(count) - next;
    if (extra <= 0) return;
    const trimmed = { ...count };
    for (const x of [...choices].reverse()) {
      const off = Math.min(extra, trimmed[x.id] ?? 0);
      trimmed[x.id] = (trimmed[x.id] ?? 0) - off;
      extra -= off;
    }
    setCount(trimmed);
  };
  return (
    <form action={action} className="stack" role="group" aria-labelledby={`party-h-${bookingId}`}
      style={{ flexBasis: 'calc(100% + 102px)', marginLeft: -102, order: 1, gap: 10, border: '1px solid var(--line)', borderRadius: 16, padding: '12px 14px', background: 'var(--ground)' }}>
      <span id={`party-h-${bookingId}`} style={{ fontSize: 15.5, fontWeight: 600 }}>
        {label}
        {choices.length ? <> · <span style={{ fontWeight: 500, color: seated === size ? 'var(--moss-dark)' : 'var(--ochre-dark)' }}>{t.seatsChosen(seated, size)}</span></> : null}
      </span>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }} id={`guests-${bookingId}`}>{t.guests}</span>
          <span style={{ fontSize: 14, color: size >= maxParty ? 'var(--ochre-dark)' : 'var(--muted)' }}>{size >= maxParty ? t.noMoreSpots : t.notCountingYou}</span>
        </div>
        <div className="stepper" role="group" aria-labelledby={`guests-${bookingId}`}>
          <button type="button" className="round" aria-label={t.removeGuest} disabled={size <= 1} onClick={lower}><Minus /></button>
          <output aria-live="polite">{size - 1}</output>
          <button type="button" className="round" aria-label={t.addGuest} disabled={size >= maxParty} onClick={() => setSize(size + 1)}><Plus /></button>
        </div>
      </div>
      {choices.map((x) => {
        const n = count[x.id] ?? 0;
        return (
          <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }} id={`seat-${bookingId}-${x.id}`}>{x.name}</span>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>{x.free === 0 ? t.full : t.left(x.free)}</span>
            </div>
            <div className="stepper" role="group" aria-labelledby={`seat-${bookingId}-${x.id}`}>
              <button type="button" className="round" aria-label={t.removeSeat(x.name)} disabled={n <= 0} onClick={() => setCount({ ...count, [x.id]: n - 1 })}><Minus /></button>
              <output aria-live="polite">{n}</output>
              <button type="button" className="round" aria-label={t.addSeat(x.name)} disabled={n >= x.free || seated >= size} onClick={() => setCount({ ...count, [x.id]: n + 1 })}><Plus /></button>
            </div>
          </div>
        );
      })}
      <input type="hidden" name="guests" value={size - 1} />
      <input type="hidden" name="partyBefore" value={party} />
      <input type="hidden" name="seats" value={JSON.stringify(choices.map((x) => ({ seatTypeId: x.id, count: count[x.id] ?? 0 })).filter((x) => x.count > 0))} />
      {state?.error ? <p className="error" role="alert" style={{ margin: 0 }}>{errorText(lang, state.error)}</p> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" className="btn" style={small} disabled={pending || needSeats || !changed}>
          {pending ? t.updating : needSeats ? t.moreSeats(size - seated) : t.saveChanges}
        </button>
        <button type="button" className="btn ghost" style={small} onClick={() => setOpen(false)}>{t.keepIt}</button>
      </div>
    </form>
  );
}
