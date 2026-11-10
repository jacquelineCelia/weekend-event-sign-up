'use client';

import { useState, useTransition } from 'react';
import type { RosterRow } from '@/lib/staff';
import type { Lang } from '@/lib/event';
import { sdict } from '@/lib/staff-i18n';
import { staffCancelAction } from '../actions';

/**
 * Check-in: cancel a sign-up after a confirmation. Before the session starts, staff can also email the
 * person that it was cancelled (on by default; email only, never a text).
 */
export default function CancelPanel({ row, lang, started, onClose, onDone }: { row: RosterRow; lang: Lang; started: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const t = sdict(lang);
  const canNotify = !started && !!row.email;
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const cancel = () =>
    start(async () => {
      setError(null);
      try {
        const r = await staffCancelAction({ bookingId: row.bookingId, notify: canNotify && notify });
        if (r.done) onDone(r.done);
        else setError(r.error ?? t.cancelFailed);
      } catch {
        setError(t.cancelFailed);
      }
    });

  const groupId = `cancel-${row.bookingId}`;
  return (
    <div className="party-editor cancel-panel" role="group" aria-labelledby={groupId}>
      <span id={groupId} style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5 }}>{t.cancelQ(row.name, row.partySize)}</span>
      {canNotify ? (
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15.5 }}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
          <span>{t.cancelNotify(row.name)}<span className="muted"> · {row.email}</span></span>
        </label>
      ) : null}
      {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn ghost" style={{ minHeight: 44 }} onClick={onClose}>{t.cancelKeep}</button>
        <button type="button" className="btn" style={{ minHeight: 44, background: 'var(--ochre-dark)' }} disabled={pending} onClick={cancel}>{pending ? t.partySaving : t.cancelYes}</button>
      </div>
    </div>
  );
}
