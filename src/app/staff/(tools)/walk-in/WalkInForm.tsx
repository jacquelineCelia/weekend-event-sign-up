'use client';

import { useActionState, useState } from 'react';
import { walkInAction, type WalkInState } from '../../actions';

export type WalkInActivity = {
  key: string; label: string; dayShort: string; name: string;
  /** Seating choices, with how many of each are left per slot (empty when the activity has none). */
  seats: { id: string; name: string; left: Record<string, number> }[];
  slots: { id: string; time: string; remaining: number; capacity: number; soon: boolean; ended: boolean }[];
};

const spots = (n: number) => `${n} ${n === 1 ? 'spot' : 'spots'}`;

export default function WalkInForm({ options, initialKey, initialSlot }: { options: WalkInActivity[]; initialKey: string; initialSlot: string | null }) {
  const [key, setKey] = useState(initialKey);
  const act = options.find((o) => o.key === key) ?? options[0];
  const usable = act?.slots.filter((s) => !s.ended) ?? [];
  const [slotId, setSlotId] = useState<string | null>(initialSlot ?? usable[0]?.id ?? null);
  const [party, setParty] = useState(1);
  const [approved, setApproved] = useState(false);
  const [checkNow, setCheckNow] = useState(true);
  const [seatWanted, setSeatWanted] = useState<Record<string, number>>({});
  const [state, action, pending] = useActionState<WalkInState, FormData>(walkInAction, null);

  // After each successful sign-up: party size back to 0 (staff set it for the next guest), and a fresh
  // form. React clears the form's fields after the action, which would leave the Activity menu showing the
  // first option while the rest of the page still shows the chosen one; re-mounting keeps them in step.
  const [seen, setSeen] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== seen) {
    setSeen(state);
    if (state?.done) { setParty(0); setSeatWanted({}); setApproved(false); setFormKey((k) => k + 1); }
  }

  const slot = usable.find((s) => s.id === slotId) ?? null;
  // Seating: how many of the party sit in each type (never more than the party).
  const seatCount: Record<string, number> = {};
  let room = party;
  for (const x of act?.seats ?? []) {
    const n = Math.max(0, Math.min(seatWanted[x.id] ?? 0, room));
    seatCount[x.id] = n;
    room -= n;
  }
  const seated = party - room;
  const hasSeats = (act?.seats.length ?? 0) > 0;
  const needSeats = hasSeats && seated !== party;
  const seatLeft = (id: string) => (slot ? act?.seats.find((x) => x.id === id)?.left[slot.id] ?? 0 : 0);
  const seatsOver = hasSeats && !!slot && act!.seats.filter((x) => seatCount[x.id] > seatLeft(x.id));
  const over = !!slot && (party > slot.remaining || (!!seatsOver && seatsOver.length > 0));
  const noParty = party < 1;
  const blocked = !slot || noParty || needSeats || (over && !approved);
  const err = state?.fields ?? {};

  const pickActivity = (k: string) => {
    setKey(k);
    const a = options.find((o) => o.key === k);
    setSlotId(a?.slots.find((s) => !s.ended)?.id ?? null);
    setSeatWanted({});
    setApproved(false);
  };

  if (!act) return <p className="muted">No activities yet. Add them on the Schedule &amp; capacity screen.</p>;

  return (
    <form key={formKey} action={action} style={{ display: 'contents' }}>
      <div className="sheet staffmain" style={{ gap: 22 }}>
        <h1 className="h1" style={{ fontSize: 30 }}>Welcome someone in</h1>

        <div className="field">
          <label htmlFor="act">Activity</label>
          <select id="act" className="input" value={key} onChange={(e) => pickActivity(e.target.value)}>
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className="legend" style={{ padding: 0, marginBottom: 8 }}>Time</legend>
          <div className="tgrid">
            {usable.map((s) => {
              const full = s.remaining === 0;
              const low = !full && s.remaining <= Math.max(2, Math.ceil(s.capacity * 0.25));
              return (
                <label key={s.id} className="tbtn" data-full={full}>
                  <input type="radio" name="slotId" value={s.id} checked={slotId === s.id} onChange={() => { setSlotId(s.id); setApproved(false); }} />
                  <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.time}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: full ? 'var(--muted-2)' : low ? 'var(--ochre)' : 'var(--moss-dark)' }}>
                    {full ? 'Full' : low ? `Only ${s.remaining} left` : `${s.remaining} left`}
                  </span>
                </label>
              );
            })}
            {usable.length === 0 ? <p className="muted">All sessions for this activity have ended.</p> : null}
          </div>
          {err.slotId ? <span className="error">{err.slotId}</span> : null}
        </fieldset>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'var(--ground)', borderRadius: 20 }}>
          <div className="stack" style={{ gap: 2 }}>
            <span style={{ fontWeight: 600 }} id="party-l">Party size</span>
            <span className="muted" style={{ fontSize: 13 }}>Including the person signing up</span>
          </div>
          <div className="stepper" role="group" aria-labelledby="party-l">
            <button type="button" className="round" aria-label="Smaller party" disabled={party <= 1} onClick={() => setParty(Math.max(1, party - 1))}>−</button>
            <output aria-live="polite">{party}</output>
            <button type="button" className="round" aria-label="Larger party" disabled={party >= 50} onClick={() => { setParty(party + 1); setApproved(false); }}>+</button>
          </div>
          <input type="hidden" name="party" value={party} />
        </div>

        {hasSeats ? (
          <fieldset style={{ border: '1px solid var(--line)', borderRadius: 20, padding: '14px 20px 16px', margin: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <legend className="legend" style={{ padding: '0 6px' }}>Seating <span className="muted" style={{ fontWeight: 400 }}>· {seated} of {party} seated</span></legend>
            {act.seats.map((x) => {
              const n = seatCount[x.id];
              const left = seatLeft(x.id);
              return (
                <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div className="stack" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 600 }} id={`seat-${x.id}`}>{x.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: !slot ? 'var(--muted)' : left === 0 ? 'var(--muted-2)' : 'var(--moss-dark)' }}>{!slot ? '' : left === 0 ? 'Full' : `${left} left`}</span>
                  </div>
                  <div className="stepper" role="group" aria-labelledby={`seat-${x.id}`}>
                    <button type="button" className="round" aria-label={`One fewer ${x.name}`} disabled={n <= 0} onClick={() => { setSeatWanted({ ...seatCount, [x.id]: n - 1 }); setApproved(false); }}>−</button>
                    <output aria-live="polite">{n}</output>
                    <button type="button" className="round" aria-label={`One more ${x.name}`} disabled={seated >= party} onClick={() => { setSeatWanted({ ...seatCount, [x.id]: n + 1 }); setApproved(false); }}>+</button>
                  </div>
                </div>
              );
            })}
            <input type="hidden" name="seats" value={JSON.stringify(act.seats.map((x) => ({ seatTypeId: x.id, count: seatCount[x.id] })).filter((x) => x.count > 0))} />
          </fieldset>
        ) : null}

        {over && slot ? (
          <div role="alert" style={{ border: '1.5px solid #b07a2a', background: 'var(--ochre-pale)', borderRadius: 20, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 600, color: 'var(--ochre-dark)' }}>
              {party > slot.remaining
                ? slot.remaining === 0 ? `This time is full. Adding ${party} would put it ${party} over capacity.`
                  : `Only ${spots(slot.remaining)} left. This party would put it ${party - slot.remaining} over capacity.`
                : `Not enough ${(seatsOver || []).map((x) => `${x.name} (${seatLeft(x.id)} left)`).join(' or ')} at this time.`}
            </span>
            <label className="check" style={{ fontSize: 14 }}>
              <input type="checkbox" name="allowOver" checked={approved} onChange={(e) => setApproved(e.target.checked)} style={{ accentColor: 'var(--ochre)' }} />
              Allow over capacity — approved by activity lead
            </label>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <Field id="name" label="Name" error={err.name} autoComplete="off" />
          <Field id="phone" label="Mobile phone" type="tel" error={err.phone} autoComplete="off" />
          <Field id="email" label="Email (optional)" type="email" error={err.email} autoComplete="off" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px' }}>
          <label className="check"><input type="checkbox" name="checkInNow" checked={checkNow} onChange={(e) => setCheckNow(e.target.checked)} /> Check them in now</label>
          <span role="radiogroup" aria-label="Messages in" style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 15 }}>
            <span className="muted">Messages in</span>
            <label className="check"><input type="radio" name="lang" value="en" defaultChecked /> English</label>
            <label className="check" lang="zh-Hant-TW"><input type="radio" name="lang" value="zh" /> 繁體中文</label>
            <label className="check" lang="zh-Hans-CN"><input type="radio" name="lang" value="zhs" /> 简体中文</label>
          </span>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: '-12px 0 0', lineHeight: 1.5 }}>
          Walk-ins aren’t texted. Add their email if they’d like a reminder 15 minutes before.
        </p>
        {slot?.soon ? <span className="muted" style={{ fontSize: 13, marginTop: -12 }}>This session starts in under 15 minutes, so no reminder will be sent for it.</span> : null}
      </div>

      <aside className="staffside" aria-label="Summary" style={{ maxWidth: 420 }}>
        <div className="summary" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14, borderRadius: 24, padding: '22px 22px 24px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#cfdacb' }}>Summary</span>
          <div className="stack" style={{ gap: 4 }}>
            <span className="serif" style={{ fontSize: 24 }}>{act.name}</span>
            <span className="sub">{act.dayShort}{slot ? ` · ${slot.time}` : ''}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #4b6152', paddingTop: 12 }}>
            <span>Party</span><span style={{ fontWeight: 600 }}>{spots(party)}</span>
          </div>
          {hasSeats && seated > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, color: 'var(--on-dark-2)' }}>
              <span>Seating</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{act.seats.filter((x) => seatCount[x.id] > 0).map((x) => `${x.name} × ${seatCount[x.id]}`).join(', ')}</span>
            </div>
          ) : null}
          {slot ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--on-dark-2)' }}>
              <span>Spots left after this</span><span style={{ fontWeight: 600 }}>{slot.remaining - party}{over ? ' (over)' : ''}</span>
            </div>
          ) : null}
          {state?.error ? <span role="alert" style={{ color: 'var(--sun)', fontWeight: 600 }}>{state.error}</span> : null}
          <button type="submit" disabled={blocked || pending} className="btn"
            style={{ background: blocked ? '#3b5644' : 'var(--paper)', color: blocked ? '#a9b8a6' : 'var(--ink)', marginTop: 4 }}>
            {pending ? 'Signing up…' : !slot ? 'Pick a time' : noParty ? 'Set the party size' : needSeats ? `Seat ${party - seated} more` : blocked ? 'Needs lead approval' : checkNow ? `Sign up & check in ${party}` : `Sign up ${party}`}
          </button>
        </div>
        {state?.done ? (
          <div className="note ok" role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14.5, borderRadius: 20, padding: '16px 20px' }}>
            <span style={{ fontWeight: 600 }}>{state.done.name} is signed up{state.done.checkedIn ? ' and checked in' : ''}.</span>
            <span>Code <b style={{ letterSpacing: '0.1em' }}>{state.done.code}</b>{state.done.to ? ` · confirmation sent to ${state.done.to}` : ''}.</span>
          </div>
        ) : null}
      </aside>
    </form>
  );
}

function Field({ id, label, error, type = 'text', autoComplete }: { id: string; label: string; error?: string; type?: string; autoComplete: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} type={type} className="input" autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={error ? `${id}-e` : undefined} />
      {error ? <span id={`${id}-e`} className="error">{error}</span> : null}
    </div>
  );
}
