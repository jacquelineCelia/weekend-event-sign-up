'use client';

import { useActionState, useState } from 'react';
import { holdAction, type FormState } from '@/app/actions';
import { Minus, Plus } from '@/components/icons';

export type PickerSlot = { id: string; range: string; short: string; remaining: number; low: boolean; past: boolean };

export default function SlotPicker({ slots, preselected }: { slots: PickerSlot[]; preselected: string | null }) {
  const [selected, setSelected] = useState<string | null>(preselected);
  const [guestsWanted, setGuests] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(holdAction, null);

  const cur = slots.find((s) => s.id === selected) ?? null;
  const maxGuests = cur ? Math.max(0, Math.min(cur.remaining, 50) - 1) : 0;
  const guests = Math.min(guestsWanted, maxGuests);
  const party = guests + 1;
  const atMax = !!cur && guests >= maxGuests;
  const roomier = cur ? slots.filter((s) => s.id !== cur.id && s.remaining > party).map((s) => s.short) : [];
  const spots = (n: number) => `${n} ${n === 1 ? 'spot' : 'spots'}`;

  return (
    <form action={action} style={{ display: 'contents' }}>
      <fieldset className="pad stack" style={{ gap: 10, border: 0, margin: 0, padding: '0 20px 22px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <legend className="h2" style={{ float: 'left', padding: 0 }}>Pick a time</legend>
          <span className="muted" style={{ fontSize: 12.5 }}>Spots update live</span>
        </div>
        {slots.length === 0 ? <p className="muted">No times on this day.</p> : null}
        {slots.map((s) => {
          const full = s.remaining === 0;
          const tag = s.past ? 'Started' : full ? 'Full' : s.low ? `Only ${s.remaining} left` : `${s.remaining} left`;
          return (
            <label key={s.id} className="slot" data-full={full}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="radio" name="slotId" value={s.id} checked={selected === s.id} disabled={full}
                  onChange={() => setSelected(s.id)} />
                <span className="radio" aria-hidden="true" />
                <span className="time">{s.range}</span>
              </span>
              <span className={`tag ${full ? 'full' : s.low ? 'low' : 'open'}`}>{tag}</span>
            </label>
          );
        })}
      </fieldset>

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

      <div className="footer">
        {state?.error ? <p className="error" role="alert" style={{ margin: 0, textAlign: 'center' }}>{state.error}</p> : null}
        <button className="btn" type="submit" disabled={!cur || pending}>
          {pending ? 'Holding your spots…' : cur ? `Continue · ${spots(party)} at ${cur.short}` : 'Pick a time to continue'}
        </button>
        <small>We&apos;ll hold these spots for 10 minutes while you finish.</small>
      </div>
    </form>
  );
}
