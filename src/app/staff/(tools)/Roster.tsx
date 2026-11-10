'use client';

import { useOptimistic, useState, useTransition } from 'react';
import type { RosterRow } from '@/lib/staff';
import { checkInAction } from '../actions';
import { Check } from '@/components/icons';
import PartyEditor, { type SeatType } from './PartyEditor';
import ContactEditor from './ContactEditor';
import CancelPanel from './CancelPanel';
import { sdict } from '@/lib/staff-i18n';
import type { Lang } from '@/lib/event';

export default function Roster({ rows, lang, seating, open: openSpots, started }: { rows: RosterRow[]; lang: Lang; seating: SeatType[]; open: number; started: boolean }) {
  const t = sdict(lang);
  const [q, setQ] = useState('');
  const [optimistic, setOptimistic] = useOptimistic(rows, (cur, u: { id: string; n: number }) =>
    cur.map((r) => (r.bookingId === u.id ? { ...r, checkedIn: u.n } : r)),
  );
  const [, start] = useTransition();
  // One panel open at a time: the party-size editor or the contact editor, for one row.
  const [editing, setEditing] = useState<{ id: string; kind: 'party' | 'contact' | 'cancel' } | null>(null);
  // A cancelled sign-up leaves the list, so its confirmation shows above the list.
  const [cancelNote, setCancelNote] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const set = (id: string, n: number) =>
    start(async () => {
      setOptimistic({ id, n });
      await checkInAction(id, n);
    });

  const ql = q.trim().toLowerCase();
  const shown = optimistic.filter((r) => !ql || r.name.toLowerCase().includes(ql) || r.phoneLast4.includes(ql) || r.code.toLowerCase().includes(ql));
  const round = { width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--line-strong)', background: 'var(--paper)', fontSize: 21.5, cursor: 'pointer' } as const;

  return (
    <>
      <div style={{ position: 'relative' }}>
        <label htmlFor="q" className="sr-only">{t.searchRoster}</label>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6A61" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ position: 'absolute', left: 18, top: 17 }}>
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input id="q" type="search" className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchRosterHint} autoComplete="off" />
      </div>

      {cancelNote ? <div className="note" role="status" style={{ fontSize: 15.5, marginTop: 12 }}>{cancelNote}</div> : null}
      <div className="roster" role="list">
        {shown.map((r) => {
          const done = r.checkedIn >= r.partySize;
          const open = editing?.id === r.bookingId ? editing.kind : null;
          const changeButton = open ? null : (
            <>
              <button type="button" className="btn ghost" style={{ minHeight: 48, fontSize: 15.5 }} onClick={() => setEditing({ id: r.bookingId, kind: 'contact' })}>{t.editContact}</button>
              <button type="button" className="btn ghost" style={{ minHeight: 48, fontSize: 15.5 }} onClick={() => setEditing({ id: r.bookingId, kind: 'party' })}>{t.changeParty}</button>
              <button type="button" className="btn ghost" style={{ minHeight: 48, fontSize: 15.5, color: 'var(--ochre-dark)' }} onClick={() => setEditing({ id: r.bookingId, kind: 'cancel' })}>{t.cancelSignup}</button>
            </>
          );
          return (
            <div key={r.bookingId} role="listitem" className="rrow" data-done={done}>
              <div className="stack" style={{ gap: 3, flex: '1 1 220px', minWidth: 0 }}>
                <span className="serif" style={{ fontSize: 19.5 }}>{r.name}
                  {r.walkIn ? <span className="stag" style={{ marginLeft: 8, fontFamily: 'var(--sans)' }}>{t.walkInTag}</span> : null}</span>
                <span className="muted" style={{ fontSize: 15 }}>
                  {t.code} <b style={{ letterSpacing: '0.08em', color: 'var(--ink-2)' }}>{r.code}</b>{r.phoneLast4 ? ` · ••${r.phoneLast4}` : ''} · {t.partyOf(r.partySize)}{r.seats ? ` · ${r.seats}` : ''}
                </span>
              </div>
              <div className="rrow-actions">
              {changeButton}
              {r.checkedIn === 0 ? (
                <div className="rrow-status">
                  <button type="button" className="btn" style={{ minHeight: 48, width: '100%', fontSize: 16.5 }} onClick={() => set(r.bookingId, r.partySize)}>
                    {t.startCheckIn}
                  </button>
                </div>
              ) : (
                <div className="rrow-status">
                  <span className="pill-status" data-done={done}><Check size={16} /> {t.nCheckedIn(r.checkedIn)}</span>
                  <button type="button" style={round} aria-label={t.oneFewerArrived(r.name)} onClick={() => set(r.bookingId, r.checkedIn - 1)}>−</button>
                  <button type="button" style={{ ...round, opacity: done ? 0.4 : 1, cursor: done ? 'not-allowed' : 'pointer' }} disabled={done}
                    aria-label={t.oneMoreArrived(r.name)} onClick={() => set(r.bookingId, r.checkedIn + 1)}>+</button>
                </div>
              )}
              </div>
              {notes[r.bookingId] && !open ? (
                <p className="hint" role="status" style={{ flex: '1 0 100%', margin: 0, fontSize: 14.5, color: 'var(--moss-dark)' }}>{notes[r.bookingId]}</p>
              ) : null}
              {open === 'party' ? (
                <PartyEditor row={r} lang={lang} seating={seating} open={openSpots} onClose={() => setEditing(null)} />
              ) : open === 'cancel' ? (
                <CancelPanel row={r} lang={lang} started={started} onClose={() => setEditing(null)} onDone={(msg) => { setEditing(null); setCancelNote(msg); }} />
              ) : open === 'contact' ? (
                <ContactEditor row={r} lang={lang} onClose={() => setEditing(null)} onSaved={(msg) => setNotes((x) => ({ ...x, [r.bookingId]: msg }))} />
              ) : null}
            </div>
          );
        })}
        {shown.length === 0 ? (
          <p className="empty" style={{ margin: 0 }}>
            {rows.length === 0 ? t.nobodyYet : t.noRosterMatch}
          </p>
        ) : null}
      </div>
    </>
  );
}
