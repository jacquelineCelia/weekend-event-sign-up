'use client';

import { useOptimistic, useState, useTransition } from 'react';
import type { RosterRow } from '@/lib/staff';
import { checkInAction } from '../actions';
import { Check } from '@/components/icons';

export default function Roster({ rows }: { rows: RosterRow[] }) {
  const [q, setQ] = useState('');
  const [optimistic, setOptimistic] = useOptimistic(rows, (cur, u: { id: string; n: number }) =>
    cur.map((r) => (r.bookingId === u.id ? { ...r, checkedIn: u.n } : r)),
  );
  const [, start] = useTransition();
  const set = (id: string, n: number) =>
    start(async () => {
      setOptimistic({ id, n });
      await checkInAction(id, n);
    });

  const ql = q.trim().toLowerCase();
  const shown = optimistic.filter((r) => !ql || r.name.toLowerCase().includes(ql) || r.phoneLast4.includes(ql) || r.code.toLowerCase().includes(ql));
  const round = { width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--line-strong)', background: 'var(--paper)', fontSize: 20, cursor: 'pointer' } as const;

  return (
    <>
      <div style={{ position: 'relative' }}>
        <label htmlFor="q" className="sr-only">Search this session</label>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6A61" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ position: 'absolute', left: 18, top: 17 }}>
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input id="q" type="search" className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, last 4 of phone, or code" autoComplete="off" />
      </div>

      <div className="roster" role="list">
        {shown.map((r) => {
          const done = r.checkedIn >= r.partySize;
          return (
            <div key={r.bookingId} role="listitem" className="rrow" data-done={done}>
              <div className="stack" style={{ gap: 3, flex: '1 1 220px', minWidth: 0 }}>
                <span className="serif" style={{ fontSize: 18 }}>{r.name}
                  {r.zh ? <span className="stag" lang="zh-Hant-TW" title="Signed up in Chinese" style={{ marginLeft: 8, fontFamily: 'var(--sans)', background: 'var(--ochre-pale)', color: 'var(--ochre-dark)' }}>中</span> : null}
                  {r.walkIn ? <span className="stag" style={{ marginLeft: 8, fontFamily: 'var(--sans)' }}>Walk-in</span> : null}</span>
                <span className="muted" style={{ fontSize: 13.5 }}>
                  Code <b style={{ letterSpacing: '0.08em', color: 'var(--ink-2)' }}>{r.code}</b>{r.phoneLast4 ? ` · ••${r.phoneLast4}` : ''} · party of {r.partySize}
                </span>
              </div>
              {r.checkedIn === 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.partySize > 1 ? (
                    <button type="button" className="btn ghost" style={{ minHeight: 48, fontSize: 14 }} onClick={() => set(r.bookingId, 1)}>Some arrived</button>
                  ) : null}
                  <button type="button" className="btn" style={{ minHeight: 48, minWidth: 150, fontSize: 15 }} onClick={() => set(r.bookingId, r.partySize)}>
                    {r.partySize === 1 ? 'Check in' : `Check in all ${r.partySize}`}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="pill-status" data-done={done}><Check size={16} /> {r.checkedIn} checked in</span>
                  <button type="button" style={round} aria-label={`One fewer arrived for ${r.name}`} onClick={() => set(r.bookingId, r.checkedIn - 1)}>−</button>
                  <button type="button" style={{ ...round, opacity: done ? 0.4 : 1, cursor: done ? 'not-allowed' : 'pointer' }} disabled={done}
                    aria-label={`One more arrived for ${r.name}`} onClick={() => set(r.bookingId, r.checkedIn + 1)}>+</button>
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 ? (
          <p className="empty" style={{ margin: 0 }}>
            {rows.length === 0 ? 'Nobody has signed up for this session yet.' : 'No match in this session. Try another session or add them as a walk-in.'}
          </p>
        ) : null}
      </div>
    </>
  );
}
