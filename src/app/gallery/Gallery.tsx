'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { dict, type Lang } from '@/lib/i18n';
import type { GalleryPhoto } from '@/lib/photos';

const thumb = (id: string) => `/api/photos/${id}/thumb`;
const full = (id: string) => `/api/photos/${id}`;

/** The photo grid, and a full-screen viewer with previous/next (buttons, arrow keys, swipe). */
export default function Gallery({ photos, showTopic, lang }: { photos: GalleryPhoto[]; showTopic: boolean; lang: Lang }) {
  const g = dict(lang).gallery;
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement | null>(null);
  const touch = useRef<number | null>(null);

  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);
  const close = useCallback(() => { setOpen(null); opener.current?.focus(); }, []);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [open, go, close]);
  useEffect(() => { if (open !== null) closeBtn.current?.focus(); }, [open === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = open === null ? null : photos[open];
  return (
    <>
      <ul className="gallery-grid">
        {photos.map((x, i) => (
          <li key={x.id}>
            <button type="button" className="gallery-tile" aria-label={g.photoAlt(x.topic, x.name)}
              onClick={(e) => { opener.current = e.currentTarget; setOpen(i); }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- served from our own route, already sized */}
              <img src={thumb(x.id)} alt="" loading="lazy" decoding="async" />
            </button>
            <span className="gallery-cap">
              <span className="gallery-name">{x.name}</span>
              {showTopic ? <span className="gallery-topic">{x.topic}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {p ? (
        <div className="viewer" role="dialog" aria-modal="true" aria-label={g.photoAlt(p.topic, p.name)}
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touch.current === null) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}>
          <div className="viewer-bar">
            <span className="viewer-pos">{g.position(open! + 1, photos.length)}</span>
            <button ref={closeBtn} type="button" className="viewer-btn" aria-label={g.close} onClick={close}>×</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- full photo from our own route */}
          <img key={p.id} className="viewer-img" src={full(p.id)} alt={g.photoAlt(p.topic, p.name)} />
          {photos.length > 1 ? (
            <>
              <button type="button" className="viewer-btn viewer-prev" aria-label={g.prev} onClick={() => go(-1)}>‹</button>
              <button type="button" className="viewer-btn viewer-next" aria-label={g.next} onClick={() => go(1)}>›</button>
            </>
          ) : null}
          <p className="viewer-cap"><span>{p.topic}</span><span aria-hidden="true"> | </span><span>{p.name}</span></p>
        </div>
      ) : null}
    </>
  );
}
