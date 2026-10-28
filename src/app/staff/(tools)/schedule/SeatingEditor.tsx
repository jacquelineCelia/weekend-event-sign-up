'use client';

import { useActionState, useState } from 'react';
import { saveSeatingAction, type ScheduleState } from '../../actions';
import type { SeatTypeRow } from '@/lib/staff';
import { Plus } from '@/components/icons';
import { sdict } from '@/lib/staff-i18n';
import type { Lang } from '@/lib/event';

type Row = { key: string; id: string | null; name: string; nameZh: string; capacity: number; minCapacity: number; inUse: boolean };

/**
 * Seating choices for one activity (e.g. "High chair" and "Ground seat"), each with a capacity that
 * applies to every time slot. With none, attendees just pick a party size.
 */
export default function SeatingEditor({ activityId, dayKey, initial, justSaved, lang }: { activityId: string; dayKey: string; initial: SeatTypeRow[]; justSaved: boolean; lang: Lang }) {
  const t = sdict(lang);
  const start: Row[] = initial.map((s) => ({ key: s.id, ...s }));
  const [rows, setRows] = useState<Row[]>(start);
  const [seq, setSeq] = useState(1);
  const [state, action, pending] = useActionState<ScheduleState, FormData>(saveSeatingAction.bind(null, activityId, dayKey), null);
  const dirty = JSON.stringify(rows.map((r) => [r.id, r.name, r.nameZh, r.capacity])) !== JSON.stringify(start.map((r) => [r.id, r.name, r.nameZh, r.capacity]));
  const total = rows.reduce((n, r) => n + r.capacity, 0);
  const missing = rows.some((r) => !r.name.trim());
  const set = (key: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const circle = { width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--line-strong)', background: 'var(--paper)', fontSize: 20, cursor: 'pointer' } as const;

  return (
    <form action={action} className="roster" aria-labelledby="seat-h">
      <input type="hidden" name="seats" value={JSON.stringify(rows.map((r) => ({ id: r.id, name: r.name, nameZh: r.nameZh, capacity: r.capacity })))} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="seat-h" className="h2">{t.seating}</h2>
          <span className="muted" style={{ fontSize: 13.5 }}>
            {rows.length ? t.seatingWith(total) : t.seatingNone}
          </span>
        </div>
      </div>
      {rows.length ? (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
            <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 190px 48px', gap: 16, padding: '10px 22px', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
              <span>{t.seatType}</span><span lang="zh-Hant-TW">中文名稱 <span lang="en" style={{ fontWeight: 400 }}>(繁體)</span></span><span>{t.perSlot}</span><span />
            </div>
            {rows.map((r, i) => {
              const minCap = r.minCapacity;
              return (
                <div key={r.key} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 22px', borderTop: '1px solid #e6e8df', background: r.id === null ? 'var(--sage-pale)' : 'var(--paper)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 190px 48px', gap: 16, alignItems: 'center' }}>
                    <input className="input" style={{ minHeight: 46 }} value={r.name} placeholder={t.seatNamePlaceholder} maxLength={40}
                      aria-label={t.seatNameAria(i + 1)} aria-invalid={!r.name.trim()} onChange={(e) => set(r.key, { name: e.target.value })} />
                    <input className="input" lang="zh-Hant-TW" style={{ minHeight: 46 }} value={r.nameZh} placeholder="例：椅子座位" maxLength={40}
                      aria-label={t.seatNameZhAria(i + 1)} onChange={(e) => set(r.key, { nameZh: e.target.value })} />
                    <div className="stepper">
                      <button type="button" style={{ ...circle, opacity: r.capacity <= minCap ? 0.4 : 1 }} disabled={r.capacity <= minCap}
                        aria-label={t.fewerSeats(r.name)} onClick={() => set(r.key, { capacity: r.capacity - 1 })}>−</button>
                      <input type="number" className="input" min={minCap} max={1000} value={r.capacity} aria-label={t.seatsPerSlot(r.name)}
                        onChange={(e) => set(r.key, { capacity: Math.max(minCap, Math.min(1000, Number(e.target.value) || minCap)) })}
                        style={{ width: 70, minHeight: 40, textAlign: 'center', padding: 0, fontFamily: 'var(--serif)', fontSize: 20 }} />
                      <button type="button" style={circle} aria-label={t.moreSeats(r.name)} onClick={() => set(r.key, { capacity: r.capacity + 1 })}>+</button>
                    </div>
                    <button type="button" disabled={r.inUse} title={r.inUse ? t.seatInUseTitle : t.removeSeatTitle}
                      aria-label={r.inUse ? t.cantRemoveSeat(r.name) : t.removeSeat(r.name)}
                      onClick={() => setRows(rows.filter((o) => o.key !== r.key))}
                      style={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${r.inUse ? 'var(--line)' : 'var(--line-strong)'}`, background: r.inUse ? 'transparent' : 'var(--paper)', color: r.inUse ? '#b3b8aa' : 'var(--ochre)', cursor: r.inUse ? 'not-allowed' : 'pointer' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                    </button>
                  </div>
                  {minCap > 0 ? <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t.seatMinNote(minCap)}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 22px', borderTop: '1px solid var(--line)', background: '#f6f7f1' }}>
        <button type="button" className="btn ghost" style={{ minHeight: 46, border: '1.5px dashed #8c9688', background: 'transparent', color: 'var(--moss-dark)' }}
          onClick={() => { setRows([...rows, { key: `n${seq}`, id: null, name: '', nameZh: '', capacity: 6, minCapacity: 0, inUse: false }]); setSeq(seq + 1); }}>
          <Plus size={18} /> {t.addSeatType}
        </button>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {state?.error ? <span className="error" role="alert">{state.error}</span>
            : dirty ? <span style={{ color: 'var(--ochre-dark)', fontWeight: 600, fontSize: 14 }}>{t.unsaved}</span>
            : justSaved ? <span role="status" style={{ color: 'var(--moss-dark)', fontSize: 14 }}>{t.seatingSaved(total)}</span> : null}
          {dirty ? <button type="button" className="btn ghost" style={{ minHeight: 46 }} onClick={() => setRows(start)}>{t.discard}</button> : null}
          <button type="submit" className="btn" style={{ minHeight: 46 }} disabled={!dirty || pending || missing}>
            {pending ? t.saving : missing ? t.nameEachSeat : t.saveSeating}
          </button>
        </span>
      </div>
    </form>
  );
}
