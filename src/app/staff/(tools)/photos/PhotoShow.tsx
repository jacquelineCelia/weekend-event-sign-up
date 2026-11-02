'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PhotoOrder } from '@/lib/photo-order';
import type { Lang } from '@/lib/event';
import { sdict } from '@/lib/staff-i18n';
import { removePhotoAction } from '../../actions';

type Photo = { id: string; name: string; topic: string };

const SECONDS_PER_PHOTO = 8;
const FEED_SECONDS = 15;
const CONTROLS_IDLE_MS = 3000;

/** The big-screen slideshow: new uploads first, then every photo topic by topic, oldest first, with its topic and who took it. */
export default function PhotoShow({ initial, lang, uploadAddress }: { initial: Photo[]; lang: Lang; uploadAddress: string }) {
  const t = sdict(lang).photos;
  const [photos, setPhotos] = useState(initial);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [portrait, setPortrait] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [tick, setTick] = useState(0); // restarts the timer even when the same photo stays on screen
  const stageRef = useRef<HTMLDivElement>(null);
  const orderRef = useRef<PhotoOrder | null>(null);
  const currentRef = useRef<string | null>(null);
  const photosRef = useRef(photos);
  const advancingRef = useRef(false);
  const removedRef = useRef(new Set<string>());

  const order = useCallback(() => (orderRef.current ??= new PhotoOrder()), []);

  /** Loads the next photo first, so the screen never shows a half-drawn image. */
  const advance = useCallback(async () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      // A photo that won't load is skipped; give up after trying each once.
      for (let tries = photosRef.current.length; tries > 0; tries--) {
        const id = order().next();
        if (!id) break;
        const img = new Image();
        img.src = `/staff/photos/image/${id}`;
        const loaded = await img.decode().then(() => true, () => false);
        if (loaded && photosRef.current.some((p) => p.id === id)) {
          currentRef.current = id;
          setCurrentId(id);
          setPortrait(img.naturalHeight > img.naturalWidth);
          return;
        }
      }
      if (!photosRef.current.some((p) => p.id === currentRef.current)) {
        currentRef.current = null;
        setCurrentId(null);
      }
    } finally {
      advancingRef.current = false;
      setTick((n) => n + 1);
    }
  }, [order]);

  const applyPhotos = useCallback((list: Photo[]) => {
    const next = list.filter((p) => !removedRef.current.has(p.id));
    photosRef.current = next;
    setPhotos(next);
    order().sync(next.map((p) => p.id));
    if (!next.some((p) => p.id === currentRef.current)) void advance();
  }, [advance, order]);

  // Start the show, then keep checking for new uploads and for photos removed elsewhere.
  // `initial` also changes when the staff language switch re-renders the page.
  useEffect(() => applyPhotos(initial), [applyPhotos, initial]);
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch('/staff/photos/feed', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const { photos: list } = await res.json();
        if (stopped) return;
        setOffline(false);
        applyPhotos(list);
      } catch {
        if (!stopped) setOffline(true); // keep showing the photos it already has
      }
    };
    const timer = setInterval(poll, FEED_SECONDS * 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, [applyPhotos]);

  const hold = paused || confirming || removing;
  useEffect(() => {
    if (hold || !currentId) return;
    const timer = setTimeout(() => void advance(), SECONDS_PER_PHOTO * 1000);
    return () => clearTimeout(timer);
  }, [advance, currentId, hold, tick]);

  // Keep the screen awake during the show, where the browser allows it.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      try {
        const got = await navigator.wakeLock.request('screen');
        if (stopped) void got.release();
        else lock = got;
      } catch { /* not allowed here: the screen's own settings apply */ }
    };
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, []);

  // In full screen the controls get out of the way until someone moves the mouse or taps.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wake = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_IDLE_MS);
  }, []);
  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === stageRef.current;
      setFullscreen(on);
      if (on) wake();
      else clearTimeout(hideTimer.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      clearTimeout(hideTimer.current);
    };
  }, [wake]);

  async function remove() {
    const id = currentRef.current;
    if (!id) return;
    setRemoving(true);
    setRemoveFailed(false);
    try {
      await removePhotoAction(id);
      removedRef.current.add(id);
      setConfirming(false);
      applyPhotos(photosRef.current);
    } catch {
      setRemoveFailed(true);
    } finally {
      setRemoving(false);
    }
  }

  const current = photos.find((p) => p.id === currentId);
  const showControls = !fullscreen || controlsVisible || confirming || removeFailed;

  return (
    <div ref={stageRef} className="show" data-full={fullscreen} data-idle={!showControls}
      onPointerMove={fullscreen ? wake : undefined} onPointerDown={fullscreen ? wake : undefined}>
      {current ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- served from the database by a staff-only route */}
          <img key={current.id} className="show-photo" data-portrait={portrait} src={`/staff/photos/image/${current.id}`} alt={t.photoAlt(current.topic, current.name)} />
          <div className="show-caption">
            <span>{current.topic}</span>
            <span aria-hidden="true" className="show-bar">|</span>
            <span>{current.name}</span>
          </div>
        </>
      ) : (
        <div className="show-empty">
          <p className="show-topic">{photos.length ? t.loading : t.empty}</p>
          {!photos.length && <p className="show-address">{t.uploadAt(uploadAddress)}</p>}
        </div>
      )}

      <div className="show-controls" hidden={!showControls}>
        {confirming ? (
          <>
            <span>{removeFailed ? t.removeFailed : t.removeConfirm}</span>
            <button type="button" className="show-danger" disabled={removing} onClick={remove}>{t.removeYes}</button>
            <button type="button" disabled={removing} onClick={() => { setConfirming(false); setRemoveFailed(false); }}>{t.removeNo}</button>
          </>
        ) : (
          <>
            <span aria-live="polite">{offline ? t.offline : t.count(photos.length)}</span>
            <button type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>{paused ? t.resume : t.pause}</button>
            <button type="button" disabled={photos.length < 2} onClick={() => void advance()}>{t.next}</button>
            <button type="button" disabled={!current} onClick={() => setConfirming(true)}>{t.remove}</button>
            <button type="button" onClick={() => (fullscreen ? document.exitFullscreen() : stageRef.current?.requestFullscreen())}>
              {fullscreen ? t.exitFullscreen : t.fullscreen}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
