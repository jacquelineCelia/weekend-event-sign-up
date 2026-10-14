'use client';

import { useActionState, useState } from 'react';
import { holdAction, type FormState } from '@/app/actions';
import { changeTimeAction } from '@/app/me/actions';
import { Minus, Plus } from '@/components/icons';
import { dict, errorText, type Lang } from '@/lib/i18n';

export type PickerSlot = {
  id: string; range: string; short: string; remaining: number; low: boolean; past: boolean;
  current?: boolean; tooSmall?: boolean;
};
type Change = { bookingId: string; partySize: number } | null;

export default function SlotPicker({ lang, slots, preselected, change }: { lang: Lang; slots: PickerSlot[]; preselected: string | null; change: Change }) {
  const t = dict(lang);
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
          <legend className="h2" style={{ float: 'left', padding: 0 }}>{change ? t.pickNewTime : t.pickTime}</legend>
          <span className="muted" style={{ fontSize: 12.5 }}>{change ? t.forYour(change.partySize) : t.spotsLive}</span>
        </div>
        {slots.length === 0 ? <p className="muted">{t.noTimes}</p> : null}
        {slots.map((s) => {
          const blocked = s.remaining === 0 || !!s.tooSmall;
          const tag = s.current ? t.yourTime : s.past ? t.started : s.remaining === 0 ? t.full : s.tooSmall || s.low ? t.onlyLeft(s.remaining) : t.left(s.remaining);
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
          <h2 id="who" className="h2">{t.whosComing}</h2>
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }} id="guests-label">{t.guests}</span>
                <span className="muted" style={{ fontSize: 13 }}>{t.notCountingYou}</span>
              </div>
              <div className="stepper" role="group" aria-labelledby="guests-label">
                <button type="button" className="round" aria-label={t.removeGuest} disabled={guests <= 0}
                  onClick={() => setGuests(Math.max(0, guests - 1))}><Minus /></button>
                <output aria-live="polite">{guests}</output>
                <button type="button" className="round" aria-label={t.addGuest} disabled={!cur || atMax}
                  onClick={() => setGuests(Math.min(maxGuests, guests + 1))}><Plus /></button>
              </div>
            </div>
            <input type="hidden" name="guests" value={guests} />
            {cur ? (
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, fontSize: 14.5, color: 'var(--ink-2)' }}>
                {t.partyLine(guests, party, cur.short)}
              </div>
            ) : null}
            {cur && atMax && cur.remaining > 1 ? (
              <div className="note" role="status">
                {t.everyOpen(cur.short)}
                {roomier.length ? t.needMore(roomier.slice(0, 2)) : ''}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="footer">
        {state?.error ? <p className="error" role="alert" style={{ margin: 0, textAlign: 'center' }}>{errorText(lang, state.error)}</p> : null}
        <button className="btn" type="submit" disabled={!cur || pending}>
          {pending
            ? change ? t.moving : t.holding
            : !cur ? t.pickToContinue
            : change ? t.moveTo(cur.short) : t.continueBtn(party, cur.short)}
        </button>
        <small>{change ? t.codeStays : t.holdNote}</small>
      </div>
    </form>
  );
}
