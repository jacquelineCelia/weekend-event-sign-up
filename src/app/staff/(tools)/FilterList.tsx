'use client';

import { useId, useState } from 'react';
import { sdict } from '@/lib/staff-i18n';
import type { Lang } from '@/lib/event';

export type FilterItem = { key: string; search: string; node: React.ReactNode };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * A search box above a list (sessions on Check-in, activities on Schedule & capacity).
 * Typing narrows the list to items whose name, place or time contain every word typed.
 * The box sticks to the top while the list scrolls, and its text survives the 20-second refresh.
 */
export default function FilterList({ items, label, placeholder, noun, lang }: {
  items: FilterItem[]; label: string; placeholder: string; noun: 'session' | 'activity'; lang: Lang;
}) {
  const t = sdict(lang);
  const [q, setQ] = useState('');
  const id = useId();
  const words = norm(q).split(' ').filter(Boolean);
  const shown = words.length ? items.filter((it) => { const s = norm(it.search); return words.every((w) => s.includes(w)); }) : items;

  return (
    <>
      <div className="listsearch">
        <label htmlFor={id} className="sr-only">{label}</label>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E6A61" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input id={id} type="search" value={q} placeholder={placeholder} autoComplete="off"
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setQ('')} />
        {q ? <button type="button" aria-label={t.clearSearch} onClick={() => setQ('')}>×</button> : null}
      </div>
      {words.length ? (
        <span className="muted" role="status" style={{ fontSize: 13, padding: '0 4px' }}>
          {t.shownOf(shown.length, items.length, noun)}
        </span>
      ) : null}
      {shown.map((it) => <div key={it.key} style={{ display: 'contents' }}>{it.node}</div>)}
      {words.length && shown.length === 0 ? (
        <p className="muted" style={{ margin: '4px', fontSize: 14 }}>
          {t.nothingMatches(q.trim())} <button type="button" onClick={() => setQ('')} style={{ border: 0, background: 'none', color: 'var(--moss)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>{t.clear}</button>
        </p>
      ) : null}
    </>
  );
}
