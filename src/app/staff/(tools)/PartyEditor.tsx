'use client';

import { useState, useTransition } from 'react';
import type { RosterRow } from '@/lib/staff';
import { Minus, Plus } from '@/components/icons';
import type { Lang } from '@/lib/event';
import { sdict } from '@/lib/staff-i18n';
import { changePartyAction } from '../actions';

export type SeatType = { id: string; name: string; capacity: number; booked: number };

/** Check-in: change how many people are in a party and, where the activity has seating, their seats. */
export default function PartyEditor({ row, lang, seating, open, onClose }: { row: RosterRow; lang: Lang; seating: SeatType[]; open: number; onClose: () => void }) {
  const t = sdict(lang);
  const own = (id: string) => row.seatPicks.find((p) => p.seatTypeId === id)?.count ?? 0;
  const [size, setSize] = useState(row.partySize);
  const [count, setCount] = useState<Record<string, number>>(() => Object.fromEntries(seating.map((x) => [x.id, own(x.id)])));
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [approved, setApproved] = useState(false);
  const [pending, start] = useTransition();

  const seatedIn = (c: Record<string, number>) => seating.reduce((n, x) => n + (c[x.id] ?? 0), 0);
  const seated = seatedIn(count);
  const needSeats = seating.length > 0 && seated !== size;
  const changed = size !== row.partySize || seating.some((x) => (count[x.id] ?? 0) !== own(x.id));

  const fewer = () => {
    const next = size - 1;
    setSize(next);
    let extra = seated - next;
    if (extra <= 0) return;
    const trimmed = { ...count };
    for (const x of [...seating].reverse()) {
      const off = Math.min(extra, trimmed[x.id] ?? 0);
      trimmed[x.id] = (trimmed[x.id] ?? 0) - off;
      extra -= off;
    }
    setCount(trimmed);
  };

  const save = () =>
    start(async () => {
      const r = await changePartyAction({
        id: row.bookingId, size, allowOver: approved,
        seats: seating.map((x) => ({ seatTypeId: x.id, count: count[x.id] ?? 0 })).filter((x) => x.count > 0),
      });
      if (r.error) {
        setError(r.error);
        setFull(!!r.full);
      } else onClose();
    });

  const groupId = `party-${row.bookingId}`;
  return (
    <div className="party-editor" role="group" aria-labelledby={groupId}>
      <span id={groupId} style={{ fontSize: 15.5, fontWeight: 600 }}>
        {t.changeParty}
        {seating.length ? <> · <span style={{ fontWeight: 500, color: needSeats ? 'var(--ochre-dark)' : 'var(--moss-dark)' }}>{t.partySeated(seated, size)}</span></> : null}
      </span>
      <div className="party-line">
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{t.partyPeople}</span>
          <span className="muted" style={{ fontSize: 14.5 }}>{t.partyOpen(open)}</span>
        </div>
        <div className="stepper">
          <button type="button" className="round" aria-label={t.partyFewer} disabled={size <= 1} onClick={fewer}><Minus /></button>
          <output aria-live="polite">{size}</output>
          <button type="button" className="round" aria-label={t.partyMore} disabled={size >= 50} onClick={() => setSize(size + 1)}><Plus /></button>
        </div>
      </div>
      {seating.map((x) => {
        const n = count[x.id] ?? 0;
        return (
          <div key={x.id} className="party-line">
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{x.name}</span>
              <span className="muted" style={{ fontSize: 14.5 }}>{t.partySeatFree(Math.max(0, x.capacity - x.booked + own(x.id)))}</span>
            </div>
            <div className="stepper">
              <button type="button" className="round" aria-label={t.partySeatFewer(x.name)} disabled={n <= 0} onClick={() => setCount({ ...count, [x.id]: n - 1 })}><Minus /></button>
              <output aria-live="polite">{n}</output>
              <button type="button" className="round" aria-label={t.partySeatMore(x.name)} disabled={seated >= size} onClick={() => setCount({ ...count, [x.id]: n + 1 })}><Plus /></button>
            </div>
          </div>
        );
      })}
      {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
      {full ? (
        <label className="check">
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} style={{ accentColor: 'var(--ochre)' }} />
          {t.allowOver}
        </label>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" style={{ minHeight: 48, fontSize: 15.5 }} disabled={pending || needSeats || !changed} onClick={save}>
          {pending ? t.partySaving : needSeats && seated < size ? t.partyMoreSeats(size - seated) : t.partySave}
        </button>
        <button type="button" className="btn ghost" style={{ minHeight: 48, fontSize: 15.5 }} disabled={pending} onClick={onClose}>{t.partyCancel}</button>
      </div>
    </div>
  );
}
