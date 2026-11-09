'use client';

import { useState, useTransition } from 'react';
import type { RosterRow } from '@/lib/staff';
import type { Lang } from '@/lib/event';
import { sdict } from '@/lib/staff-i18n';
import { updateContactAction } from '../actions';

/** Check-in: fix a guest's name, email or phone (e.g. a mistyped email). Applies to all their sign-ups. */
export default function ContactEditor({ row, lang, onClose, onSaved }: { row: RosterRow; lang: Lang; onClose: () => void; onSaved: (msg: string) => void }) {
  const t = sdict(lang);
  const [name, setName] = useState(row.name);
  const [email, setEmail] = useState(row.email);
  const [phone, setPhone] = useState(row.phone);
  const [resend, setResend] = useState(true);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const emailChanged = email.trim().toLowerCase() !== row.email.toLowerCase();
  const phoneChanged = phone.replace(/[^\d+]/g, '') !== row.phone.replace(/[^\d+]/g, '');
  const changed = name.trim() !== row.name || emailChanged || phoneChanged;

  const save = () =>
    start(async () => {
      setError(null);
      try {
        const r = await updateContactAction({ bookingId: row.bookingId, name, email, phone, resend: resend && emailChanged });
        setFields(r.fields ?? {});
        if (r.error) setError(r.error);
        else if (r.saved) { onSaved(r.saved); onClose(); }
      } catch {
        setError(t.contactFailed);
      }
    });

  const id = (f: string) => `contact-${f}-${row.bookingId}`;
  const field = (f: 'name' | 'email' | 'phone', label: string, value: string, set: (v: string) => void, type = 'text') => (
    <div className="field" style={{ gap: 6 }}>
      <label htmlFor={id(f)} style={{ fontSize: 15 }}>{label}</label>
      <input id={id(f)} className="input" type={type} value={value} aria-invalid={!!fields[f]}
        inputMode={type === 'email' ? 'email' : type === 'tel' ? 'tel' : undefined} autoComplete="off"
        onChange={(e) => { set(e.target.value); setFields((x) => ({ ...x, [f]: '' })); }} />
      {fields[f] ? <span className="error">{fields[f]}</span> : null}
    </div>
  );

  const groupId = `contact-${row.bookingId}`;
  return (
    <div className="party-editor" role="group" aria-labelledby={groupId}>
      <span id={groupId} style={{ fontSize: 15.5, fontWeight: 600 }}>
        {t.editContact} <span className="muted" style={{ fontWeight: 400 }}>· {t.contactAppliesAll(row.name)}</span>
      </span>
      {field('name', t.name, name, setName)}
      {field('email', t.walkInEmail, email, setEmail, 'email')}
      {field('phone', t.mobileOptional, phone, setPhone, 'tel')}
      {phoneChanged && row.phone ? <p className="hint" style={{ margin: 0, fontSize: 14.5 }}>{t.contactPhoneNote}</p> : null}
      {emailChanged ? (
        <label className="check" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15.5 }}>
          <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
          <span>{t.contactResend}</span>
        </label>
      ) : null}
      {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn ghost" style={{ minHeight: 44 }} onClick={onClose}>{t.partyCancel}</button>
        <button type="button" className="btn" style={{ minHeight: 44 }} disabled={!changed || pending} onClick={save}>{pending ? t.partySaving : t.partySave}</button>
      </div>
    </div>
  );
}
