'use client';

import { useActionState, useState } from 'react';
import { holdAction, type FormState } from '@/app/actions';
import { changeTimeAction } from '@/app/me/actions';
import { Minus, Plus } from '@/components/icons';

export type PickerSlot = {
  id: string; range: string; short: string; remaining: number; low: boolean; past: boolean;
  current?: boolean; tooSmall?: boolean;
};
type Change = { bookingId: string; partySize: number } | null;

const spots = (n: number) => `${n} ${n === 1 ? 'spot' : 'spots'}`;

export default function SlotPicker({ slots, preselected, change }: { slots: PickerSlot[]; preselected: string | null; change: Change }) {
  const [selected, setSelected] = useState<string | null>(preselected);
  const [guestsWanted, setGuests] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(
    change ? changeTimeAction.bind(null, change.bookingId) : holdAction,
    null,
  );

  const cur = slots.find((s) => s.id === selected) ?? null;
  const maxGuests = cur ? Math.max(0, Math.min(cur.remaining, 50) - 1) : 0;
  const guests = Math.min(guestsWanted, maxGuests);
  const party = change ? change.partySize : guests + 1;
  const atMax = !change && !!cur && guests >= maxGuests;
  const roomier = cur ? slots.filter((s) => s.id !== cur.id && s.remaining > party).map((s) => s.short) : [];

  return (
    <form action={action} style={{ display: 'contents' }}>
      <fieldset className="pad stack" style={{ gap: 10, border: 0, margin: 0, padding: '0 20px 22px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <legend className="h2" style={{ float: 'left', padding: 0 }}>{change ? 'Pick a new time' : 'Pick a time'}</legend>
          <span className="muted" style={{ fontSize: 12.5 }}>{change ? `For your ${spots(change.partySize)}` : 'Spots update live'}</span>
        </div>
        {slots.length === 0 ? <p className="muted">No times on this day.</p> : null}
        {slots.map((s) => {
          const blocked = s.remaining === 0 || !!s.tooSmall;
          const tag = s.current ? 'Your time' : s.past ? 'Started' : s.remaining === 0 ? 'Full' : s.tooSmall || s.low ? `Only ${s.remaining} left` : `${s.remaining} left`;
          const tone = s.current ? 'open' : blocked ? 'full' : s.low ? 'low' : 'open';
          return (
            <label key={s.id} className="slot" data-full={blocked}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="radio" name="slotId" value={s.id} checked={selected === s.id} disabled={blocked}
                  onChange={() => setSelected(s.id)} />
                <span className="radio" aria-hidden="true" />
                <span className="time">{s.range}</span>
              </span>
              <span className={`tag ${tone}`}>{tag}</span>
            </label>
          );
        })}
      </fieldset>

      {!change ? (
        <section className="pad stack" aria-labelledby="who" style={{ gap: 10, paddingBottom: 26 }}>
          <h2 id="who" className="h2">Who&apos;s coming?</h2>
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }} id="guests-label">Guests</span>
                <span className="muted" style={{ fontSize: 13 }}>Not counting you</span>
              </div>
              <div className="stepper" role="group" aria-labelledby="guests-label">
                <button type="button" className="round" aria-label="Remove a guest" disabled={guests <= 0}
                  onClick={() => setGuests(Math.max(0, guests - 1))}><Minus /></button>
                <output aria-live="polite">{guests}</output>
                <button type="button" className="round" aria-label="Add a guest" disabled={!cur || atMax}
                  onClick={() => setGuests(Math.min(maxGuests, guests + 1))}><Plus /></button>
              </div>
            </div>
            <input type="hidden" name="guests" value={guests} />
            {cur ? (
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, fontSize: 14.5, color: 'var(--ink-2)' }}>
                You + {guests} {guests === 1 ? 'guest' : 'guests'} = {spots(party)} at {cur.short}.
              </div>
            ) : null}
            {cur && atMax && cur.remaining > 1 ? (
              <div className="note" role="status">
                That&apos;s every open spot at {cur.short}.
                {roomier.length ? ` Need more room? ${roomier.slice(0, 2).join(' and ')} ${roomier.length === 1 ? 'has' : 'have'} more space.` : ''}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="footer">
        {state?.error ? <p className="error" role="alert" style={{ margin: 0, textAlign: 'center' }}>{state.error}</p> : null}
        <button className="btn" type="submit" disabled={!cur || pending}>
          {pending
            ? change ? 'Moving your booking…' : 'Holding your spots…'
            : !cur ? 'Pick a time to continue'
            : change ? `Move to ${cur.short}` : `Continue · ${spots(party)} at ${cur.short}`}
        </button>
        <small>{change ? 'Your check-in code stays the same.' : 'We’ll hold these spots for 10 minutes while you finish.'}</small>
      </div>
    </form>
  );
}
