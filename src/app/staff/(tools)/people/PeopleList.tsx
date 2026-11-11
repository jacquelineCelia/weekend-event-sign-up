'use client';

import Link from 'next/link';
import { useState } from 'react';
import { nameRuns } from '@/components/ActivityName';
import type { Lang } from '@/lib/event';
import { sdict } from '@/lib/staff-i18n';

export type PersonView = {
  id: string; name: string; email: string; phone: string;
  signups: { id: string; when: string; activity: string; zh: boolean; place: string; party: number; checkedIn: number; code: string; walkIn: boolean; seats: string; roster: string }[];
};

/** The attendee list with a search box (name, email, phone digits or sign-up code). */
export default function PeopleList({ people, lang, htmlLang }: { people: PersonView[]; lang: Lang; htmlLang: string }) {
  const t = sdict(lang);
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const digits = ql.replace(/\D/g, '');
  const shown = people.filter((p) =>
    !ql || p.name.toLowerCase().includes(ql) || p.email.toLowerCase().includes(ql)
    || (digits.length >= 3 && p.phone.replace(/\D/g, '').includes(digits))
    || p.signups.some((s) => s.code.toLowerCase() === ql),
  );

  return (
    <>
      <div style={{ position: 'relative', marginTop: 18 }}>
        <label htmlFor="pq" className="sr-only">{t.people.search}</label>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6A61" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ position: 'absolute', left: 18, top: 17 }}>
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input id="pq" type="search" className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.people.search} autoComplete="off" />
      </div>

      <div className="roster" role="list" style={{ marginTop: 16 }}>
        {shown.map((p) => (
          <div key={p.id} role="listitem" className="rrow" style={{ alignItems: 'flex-start' }}>
            <div className="stack" style={{ gap: 3, flex: '1 1 220px', minWidth: 0 }}>
              <span className="serif" style={{ fontSize: 20 }}>{p.name}</span>
              <span className="muted" style={{ fontSize: 15, overflowWrap: 'anywhere' }}>{[p.email, p.phone].filter(Boolean).join(' · ')}</span>
              <span className="stag" style={{ alignSelf: 'flex-start', marginTop: 4 }}>{t.people.count(p.signups.length)}</span>
            </div>
            <ul className="people-signups">
              {p.signups.map((s) => (
                <li key={s.id}>
                  <Link href={s.roster}>
                    <span className="people-when">{s.when}</span>
                    <span className={s.zh ? 'zhname' : undefined} lang={s.zh ? htmlLang : 'en'} style={{ fontWeight: 600 }}>{nameRuns(s.activity)}</span>
                    <span className="muted">
                      {s.place} · {t.partyOf(s.party)}{s.seats ? ` · ${s.seats}` : ''} · {t.code} <b style={{ letterSpacing: '0.06em', color: 'var(--ink-2)' }}>{s.code}</b>
                      {s.walkIn ? ` · ${t.walkInTag}` : ''}{s.checkedIn ? ` · ${t.nCheckedIn(s.checkedIn)}` : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {shown.length === 0 ? <p className="empty" style={{ margin: 0 }}>{people.length ? t.people.noMatch : t.people.none}</p> : null}
      </div>
    </>
  );
}
