'use client';

import { useActionState, useMemo, useState } from 'react';
import { saveScheduleAction, type ScheduleState } from '../../actions';
import type { ScheduleSlot } from '@/lib/staff';
import { Plus } from '@/components/icons';

type Row = { key: string; id: string | null; time: string; capacity: number; booked: number; held: number; origTime: string | null };

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const pad = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fmt = (m: number) => {
  m = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function SlotEditor({ activityId, day, dayName, durationMin, initial, seatTotal, justSaved }: {
  activityId: string; day: string; dayName: string; durationMin: number; initial: ScheduleSlot[];
  /** With seating choices, every slot's capacity is the seats' total (set under Seating). */
  seatTotal: number | null; justSaved: number | null;
}) {
  const start: Row[] = initial.map((s) => ({ key: s.id, id: s.id, time: s.time, capacity: s.capacity, booked: s.booked, held: s.held, origTime: s.time }));
  const [rows, setRows] = useState<Row[]>(start);
  const [seq, setSeq] = useState(1);
  const [defCap, setDefCap] = useState(Math.max(1, ...initial.map((s) => s.capacity), 10));
  const [state, action, pending] = useActionState<ScheduleState, FormData>(saveScheduleAction.bind(null, activityId, day), null);

  const dirty = JSON.stringify(rows.map((r) => [r.id, r.time, r.capacity])) !== JSON.stringify(start.map((r) => [r.id, r.time, r.capacity]));
  const clash = useMemo(() => {
    const out = new Map<string, string>();
    for (const r of rows) {
      const other = rows.find((o) => o !== r && toMin(r.time) < toMin(o.time) + durationMin && toMin(o.time) < toMin(r.time) + durationMin);
      if (other) out.set(r.key, other.time);
    }
    return out;
  }, [rows, durationMin]);

  const set = (key: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () => {
    const last = rows.length ? Math.max(...rows.map((r) => toMin(r.time))) + durationMin + 30 : 10 * 60;
    setRows([...rows, { key: `n${seq}`, id: null, time: pad(Math.min(last, 22 * 60)), capacity: seatTotal ?? defCap, booked: 0, held: 0, origTime: null }]);
    setSeq(seq + 1);
  };
  const totalCap = rows.reduce((n, r) => n + r.capacity, 0);
  const totalBooked = rows.reduce((n, r) => n + r.booked, 0);
  const circle = { width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--line-strong)', background: 'var(--paper)', fontSize: 20, cursor: 'pointer' } as const;

  return (
    <form action={action} className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="slots" value={JSON.stringify(rows.map((r) => ({ id: r.id, time: r.time, capacity: r.capacity })))} />
      <section className="roster" aria-labelledby="slots-h">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
          <h2 id="slots-h" className="h2">Time slots</h2>
          <span className="muted" style={{ fontSize: 13.5 }}>{rows.length} {rows.length === 1 ? 'slot' : 'slots'} · {totalCap} spots · {totalBooked} booked</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
            <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: '150px 100px 190px minmax(0,1fr) 48px', gap: 16, padding: '10px 22px', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
              <span>Starts</span><span>Ends</span><span>Capacity</span><span>Booked</span><span />
            </div>
            {rows.map((r, i) => {
              const taken = r.booked + r.held;
              const minCap = Math.max(1, taken);
              const locked = taken > 0;
              const moved = r.origTime !== null && r.origTime !== r.time;
              const c = clash.get(r.key);
              const note = c ? `Overlaps the ${fmt(toMin(c))} slot — move one of them before saving.`
                : moved && r.booked > 0 ? `${r.booked} booked ${r.booked === 1 ? 'guest' : 'guests'} will be told the new time (was ${fmt(toMin(r.origTime!))}).`
                : r.id === null ? 'New slot · opens for sign-ups when you save.'
                : r.capacity <= taken && taken > 0 ? 'Capacity is at the number already booked.' : '';
              return (
                <div key={r.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 22px', borderTop: '1px solid #e6e8df', background: c ? '#fbf4e6' : r.id === null ? 'var(--sage-pale)' : 'var(--paper)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '150px 100px 190px minmax(0,1fr) 48px', gap: 16, alignItems: 'center' }}>
                    <input type="time" step={300} className="input" style={{ minHeight: 46, fontWeight: 600 }} value={r.time}
                      aria-label={`Start time, slot ${i + 1}`} onChange={(e) => e.target.value && set(r.key, { time: e.target.value })} />
                    <span style={{ color: 'var(--ink-2)' }}>{fmt(toMin(r.time) + durationMin)}</span>
                    {seatTotal !== null ? (
                      <span style={{ fontSize: 14, color: 'var(--ink-2)' }} title="Set by the seat types under Seating"><b style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400 }}>{r.capacity}</b> · from seating</span>
                    ) : (
                    <div className="stepper">
                      <button type="button" style={{ ...circle, opacity: r.capacity <= minCap ? 0.4 : 1 }} disabled={r.capacity <= minCap}
                        aria-label={`Lower capacity for the ${fmt(toMin(r.time))} slot`} onClick={() => set(r.key, { capacity: r.capacity - 1 })}>−</button>
                      <input type="number" className="input" min={minCap} max={1000} value={r.capacity} aria-label={`Capacity for the ${fmt(toMin(r.time))} slot`}
                        onChange={(e) => set(r.key, { capacity: Math.max(minCap, Math.min(1000, Number(e.target.value) || minCap)) })}
                        style={{ width: 70, minHeight: 40, textAlign: 'center', padding: 0, fontFamily: 'var(--serif)', fontSize: 20 }} />
                      <button type="button" style={circle} aria-label={`Raise capacity for the ${fmt(toMin(r.time))} slot`} onClick={() => set(r.key, { capacity: r.capacity + 1 })}>+</button>
                    </div>
                    )}
                    <span style={{ fontSize: 14, fontWeight: 600, color: r.booked === 0 ? 'var(--muted)' : r.booked >= r.capacity ? 'var(--ochre)' : 'var(--moss-dark)' }}>
                      {r.booked === 0 ? 'No bookings yet' : `${r.booked} booked · ${r.booked >= r.capacity ? 'full' : `${r.capacity - r.booked} open`}`}
                    </span>
                    <button type="button" disabled={locked} title={locked ? 'Has bookings — move or cancel guests first' : 'Delete slot'}
                      aria-label={locked ? `Can't delete the ${fmt(toMin(r.time))} slot: it has bookings` : `Delete the ${fmt(toMin(r.time))} slot`}
                      onClick={() => setRows(rows.filter((o) => o.key !== r.key))}
                      style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${locked ? 'var(--line)' : 'var(--line-strong)'}`, background: locked ? 'transparent' : 'var(--paper)', color: locked ? '#b3b8aa' : 'var(--ochre)', cursor: locked ? 'not-allowed' : 'pointer' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                    </button>
                  </div>
                  {note ? <span style={{ fontSize: 13, color: c || moved ? 'var(--ochre-dark)' : r.id === null ? 'var(--moss-dark)' : 'var(--muted)' }}>{note}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
        {rows.length === 0 ? <p style={{ padding: '22px', margin: 0, color: 'var(--muted)' }}>No time slots on {dayName} yet. Attendees won&apos;t see this activity that day until you add one.</p> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '18px 22px', borderTop: '1px solid var(--line)', background: '#f6f7f1' }}>
          <button type="button" onClick={add} className="btn ghost" style={{ minHeight: 48, border: '1.5px dashed #8c9688', background: 'transparent', color: 'var(--moss-dark)' }}>
            <Plus size={18} /> Add a time slot
          </button>
          {seatTotal === null ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--ink-2)' }}>
            New slots start with capacity
            <input type="number" min={1} max={1000} value={defCap} onChange={(e) => setDefCap(Math.max(1, Number(e.target.value) || 1))} className="input" style={{ width: 80, minHeight: 40, textAlign: 'center', padding: 0 }} />
          </label>
          ) : null}
        </div>
      </section>

      <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
        {seatTotal !== null ? 'Capacity comes from the seat types under Seating, the same for every slot. ' : 'Capacity can\u2019t drop below the number already booked, and '}
        {seatTotal !== null ? 'Slots' : 'slots'} with bookings can&apos;t be deleted. If you move a booked slot, those guests get a message with the new time.
      </p>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 18, padding: '12px 18px', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        {state?.error ? <span className="error" role="alert" style={{ marginRight: 'auto' }}>{state.error}</span>
          : dirty ? <span style={{ marginRight: 'auto', color: 'var(--ochre-dark)', fontWeight: 600, fontSize: 14 }}>Unsaved changes</span>
          : <span role="status" style={{ marginRight: 'auto', color: 'var(--moss-dark)', fontSize: 14 }}>
              {justSaved !== null ? `Saved. Attendees see the new times and capacity right away.${justSaved ? ` ${justSaved} ${justSaved === 1 ? 'guest was' : 'guests were'} told about a time change.` : ''}` : 'All changes saved'}
            </span>}
        {dirty ? <button type="button" className="btn ghost" style={{ minHeight: 46 }} onClick={() => setRows(start)}>Discard</button> : null}
        <button type="submit" className="btn" style={{ minHeight: 46 }} disabled={!dirty || pending || clash.size > 0}>
          {pending ? 'Saving…' : clash.size > 0 ? 'Fix overlaps to save' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
