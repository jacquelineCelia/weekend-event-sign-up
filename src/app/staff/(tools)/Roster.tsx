'use client';

import { useOptimistic, useState, useTransition } from 'react';
import type { RosterRow } from '@/lib/staff';
import { checkInAction } from '../actions';
import { Check } from '@/components/icons';
import { sdict } from '@/lib/staff-i18n';
import type { Lang } from '@/lib/event';

export default function Roster({ rows, lang }: { rows: RosterRow[]; lang: Lang }) {
  const t = sdict(lang);
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
        <label htmlFor="q" className="sr-only">{t.searchRoster}</label>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6A61" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ position: 'absolute', left: 18, top: 17 }}>
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input id="q" type="search" className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchRosterHint} autoComplete="off" />
      </div>

      <div className="roster" role="list">
        {shown.map((r) => {
          const done = r.checkedIn >= r.partySize;
          return (
            <div key={r.bookingId} role="listitem" className="rrow" data-done={done}>
              <div className="stack" style={{ gap: 3, flex: '1 1 220px', minWidth: 0 }}>
                <span className="serif" style={{ fontSize: 18 }}>{r.name}
                  {r.lang !== 'en' ? <span className="stag" lang={r.lang === 'zh' ? 'zh-Hant-TW' : 'zh-Hans-CN'} title={r.lang === 'zh' ? t.signedUpZh : t.signedUpZhs} style={{ marginLeft: 8, fontFamily: 'var(--sans)', background: 'var(--ochre-pale)', color: 'var(--ochre-dark)' }}>{r.lang === 'zh' ? '繁' : '简'}</span> : null}
                  {r.walkIn ? <span className="stag" style={{ marginLeft: 8, fontFamily: 'var(--sans)' }}>{t.walkInTag}</span> : null}</span>
                <span className="muted" style={{ fontSize: 13.5 }}>
                  {t.code} <b style={{ letterSpacing: '0.08em', color: 'var(--ink-2)' }}>{r.code}</b>{r.phoneLast4 ? ` · ••${r.phoneLast4}` : ''} · {t.partyOf(r.partySize)}{r.seats ? ` · ${r.seats}` : ''}
                </span>
              </div>
              {r.checkedIn === 0 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.partySize > 1 ? (
                    <button type="button" className="btn ghost" style={{ minHeight: 48, fontSize: 14 }} onClick={() => set(r.bookingId, 1)}>{t.someArrived}</button>
                  ) : null}
                  <button type="button" className="btn" style={{ minHeight: 48, minWidth: 150, fontSize: 15 }} onClick={() => set(r.bookingId, r.partySize)}>
                    {r.partySize === 1 ? t.checkIn : t.checkInAll(r.partySize)}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="pill-status" data-done={done}><Check size={16} /> {t.nCheckedIn(r.checkedIn)}</span>
                  <button type="button" style={round} aria-label={t.oneFewerArrived(r.name)} onClick={() => set(r.bookingId, r.checkedIn - 1)}>−</button>
                  <button type="button" style={{ ...round, opacity: done ? 0.4 : 1, cursor: done ? 'not-allowed' : 'pointer' }} disabled={done}
                    aria-label={t.oneMoreArrived(r.name)} onClick={() => set(r.bookingId, r.checkedIn + 1)}>+</button>
                </div>
              )}
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
