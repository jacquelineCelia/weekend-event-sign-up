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
/** A seat type the party can choose (e.g. "High chair"), with how many are left at each time. */
export type PickerSeat = { id: string; name: string; left: Record<string, number> };
type Change = { bookingId: string; partySize: number } | null;

export default function SlotPicker({ lang, slots, seats, preselected, change }: { lang: Lang; slots: PickerSlot[]; seats: PickerSeat[]; preselected: string | null; change: Change }) {
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

  // Seating: how many of the party sit in each type. Kept within what's left at the chosen time
  // and within the party size (dropping from the last types first when the party shrinks).
  const [seatWanted, setSeatWanted] = useState<Record<string, number>>({});
  const seatLeft = (id: string) => (cur ? seats.find((x) => x.id === id)?.left[cur.id] ?? 0 : 0);
  const seatCount: Record<string, number> = {};
  let room = party;
  for (const x of seats) {
    const n = Math.max(0, Math.min(seatWanted[x.id] ?? 0, seatLeft(x.id), room));
    seatCount[x.id] = n;
    room -= n;
  }
  const seated = party - room;
  const needSeats = !change && seats.length > 0 && seated !== party;
  const setSeat = (id: string, n: number) => setSeatWanted({ ...seatCount, [id]: n });
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

          {seats.length ? (
            <div className="panel" role="group" aria-labelledby="seating-h" aria-describedby="seating-d">
              <div className="stack" style={{ gap: 2 }}>
                <h3 id="seating-h" style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{t.seating}</h3>
                <span id="seating-d" className="muted" style={{ fontSize: 13 }}>{t.seatingLede(party)}</span>
              </div>
              {seats.map((x) => {
                const left = seatLeft(x.id);
                const n = seatCount[x.id];
                return (
                  <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 600 }} id={`seat-${x.id}`}>{x.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: !cur ? 'var(--muted)' : left === 0 ? 'var(--muted-2)' : 'var(--moss-dark)' }}>
                        {!cur ? '' : left === 0 ? t.full : t.left(left)}
                      </span>
                    </div>
                    <div className="stepper" role="group" aria-labelledby={`seat-${x.id}`}>
                      <button type="button" className="round" aria-label={t.removeSeat(x.name)} disabled={n <= 0}
                        onClick={() => setSeat(x.id, n - 1)}><Minus /></button>
                      <output aria-live="polite">{n}</output>
                      <button type="button" className="round" aria-label={t.addSeat(x.name)} disabled={!cur || n >= left || seated >= party}
                        onClick={() => setSeat(x.id, n + 1)}><Plus /></button>
                    </div>
                  </div>
                );
              })}
              <div role="status" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, fontSize: 14.5, fontWeight: 600, color: seated === party ? 'var(--moss-dark)' : 'var(--ochre-dark)' }}>
                {t.seatsChosen(seated, party)}
              </div>
              <input type="hidden" name="seats" value={JSON.stringify(seats.map((x) => ({ seatTypeId: x.id, count: seatCount[x.id] })).filter((x) => x.count > 0))} />
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="footer">
        {state?.error ? <p className="error" role="alert" style={{ margin: 0, textAlign: 'center' }}>{errorText(lang, state.error)}</p> : null}
        <button className="btn" type="submit" disabled={!cur || pending || needSeats}>
          {pending
            ? change ? t.moving : t.holding
            : !cur ? t.pickToContinue
            : needSeats ? t.moreSeats(party - seated)
            : change ? t.moveTo(cur.short) : t.continueBtn(party, cur.short)}
        </button>
        <small>{change ? t.codeStays : t.holdNote}</small>
      </div>
    </form>
  );
}
