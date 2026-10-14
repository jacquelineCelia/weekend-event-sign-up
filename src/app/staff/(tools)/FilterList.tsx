'use client';

import { useId, useState } from 'react';

export type FilterItem = { key: string; search: string; node: React.ReactNode };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * A search box above a list (sessions on Check-in, activities on Schedule & capacity).
 * Typing narrows the list to items whose name, place or time contain every word typed.
 * The box sticks to the top while the list scrolls, and its text survives the 20-second refresh.
 */
export default function FilterList({ items, label, placeholder, noun }: {
  items: FilterItem[]; label: string; placeholder: string; noun: [string, string];
}) {
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
        {q ? <button type="button" aria-label="Clear search" onClick={() => setQ('')}>×</button> : null}
      </div>
      {words.length ? (
        <span className="muted" role="status" style={{ fontSize: 13, padding: '0 4px' }}>
          {shown.length} of {items.length} {items.length === 1 ? noun[0] : noun[1]}
        </span>
      ) : null}
      {shown.map((it) => <div key={it.key} style={{ display: 'contents' }}>{it.node}</div>)}
      {words.length && shown.length === 0 ? (
        <p className="muted" style={{ margin: '4px', fontSize: 14 }}>
          Nothing matches “{q.trim()}”. <button type="button" onClick={() => setQ('')} style={{ border: 0, background: 'none', color: 'var(--moss)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>Clear</button>
        </p>
      ) : null}
    </>
  );
}
