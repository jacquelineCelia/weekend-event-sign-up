'use client';

import Link from 'next/link';
import { useState } from 'react';
import { nameRuns } from '@/components/ActivityName';
import type { Lang } from '@/lib/event';
import { sdict } from '@/lib/staff-i18n';
import { activityHit, matchSignups } from '@/lib/people-filter';

export type PersonView = {
  id: string; name: string; email: string; phone: string;
  signups: { id: string; when: string; activity: string; find: string; zh: boolean; place: string; party: number; checkedIn: number; code: string; walkIn: boolean; seats: string; roster: string }[];
};

/** The attendee list with a search box, a filter by number of activities, and a CSV of what's shown. */
export default function PeopleList({ people, lang, htmlLang, title, summary }: { people: PersonView[]; lang: Lang; htmlLang: string; title: string; summary: string }) {
  const t = sdict(lang);
  const [q, setQ] = useState('');
  // Filter by how many activities a person signed up for (null = everyone).
  const [count, setCount] = useState<number | null>(null);
  const counts = [...new Set(people.map((p) => p.signups.length))].sort((a, b) => a - b);
  const ql = q.trim().toLowerCase();
  const shown = people.filter((p) => matchSignups(p, q, count) !== null);
  // When the search names an activity, those sign-ups are outlined so staff see which one matched.
  const hit = (s: PersonView['signups'][number]) => activityHit(s, q);
  // The CSV holds what's on screen: the same search and filter, applied on the server.
  const params = new URLSearchParams();
  if (ql) params.set('q', q.trim());
  if (count !== null) params.set('count', String(count));
  const csvHref = `/staff/people/csv${params.size ? `?${params}` : ''}`;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <h1 className="h1" style={{ fontSize: 34 }}>{title}</h1>
          {/* Totals for everyone signed up (not the search): people, sign-ups, spots including guests. */}
          <span className="muted" style={{ fontSize: 16.5 }}>{summary}</span>
        </div>
        {shown.length ? <a className="btn ghost" href={csvHref} style={{ minHeight: 48, fontSize: 16 }}>{t.people.download}</a> : null}
      </div>
      <div style={{ position: 'relative', marginTop: 18 }}>
        <label htmlFor="pq" className="sr-only">{t.people.search}</label>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5E6A61" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ position: 'absolute', left: 18, top: 17 }}>
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input id="pq" type="search" className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.people.search} autoComplete="off" />
      </div>

      {counts.length > 1 ? (
        <div className="countfilter" role="group" aria-label={t.people.byCount}>
          <span className="muted">{t.people.byCount}</span>
          {/* No "everyone" button: tapping the chosen one again clears the filter. */}
          {counts.map((n) => (
            <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(count === n ? null : n)}>
              {t.people.count(n)} <span>{people.filter((p) => p.signups.length === n).length}</span>
            </button>
          ))}
        </div>
      ) : null}
      {(ql || count !== null) && shown.length ? <p className="muted" role="status" style={{ margin: '10px 4px 0', fontSize: 15.5 }}>{t.people.found(shown.length)}</p> : null}
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
                <li key={s.id} data-hit={hit(s) || undefined}>
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
