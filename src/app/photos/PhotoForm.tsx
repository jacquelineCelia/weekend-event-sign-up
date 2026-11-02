'use client';

import Link from 'next/link';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { dict, type Lang } from '@/lib/i18n';

// Sharp on a 1080p screen, and small enough to upload on event Wi-Fi and to keep many photos.
const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** Resizes to a JPEG. Re-encoding also drops the location data phones put in their photos. */
async function prepare(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('could not encode');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Errors = { name?: string; topic?: string; photo?: string; form?: string };

export default function PhotoForm({ lang, topics }: { lang: Lang; topics: { id: string; name: string; hint: string }[] }) {
  const t = dict(lang).photos;
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const previewUrl = photo?.url;

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still counts as a change
    if (!file) return;
    setPreparing(true);
    setErrors((x) => ({ ...x, photo: undefined, form: undefined }));
    try {
      const blob = await prepare(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setPhoto(null);
      setErrors((x) => ({ ...x, photo: t.errRead }));
    } finally {
      setPreparing(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const missing: Errors = {
      name: name.trim() ? undefined : t.errName,
      topic: topic ? undefined : t.errTopic,
      photo: photo ? undefined : t.errPhoto,
    };
    setErrors(missing);
    if (missing.name || missing.topic || !photo) return;

    const body = new FormData();
    body.set('name', name);
    body.set('topic', topic);
    body.set('image', photo.blob, 'photo.jpg');
    setUploading(true);
    try {
      const res = await fetch('/api/photos', { method: 'POST', body });
      if (res.ok) {
        setDone(true);
        window.scrollTo(0, 0);
        return;
      }
      const code = (await res.json().catch(() => null))?.error;
      setErrors(
        code === 'name' ? { name: t.errName }
        : code === 'topic' ? { topic: t.errTopic }
        : code === 'image' ? { photo: t.errRead }
        : { form: code === 'busy' ? t.errBusy : code === 'full' ? t.errFull : t.errFailed },
      );
    } catch {
      setErrors({ form: t.errFailed });
    } finally {
      setUploading(false);
    }
  }

  function another() {
    setDone(false);
    setTopic('');
    setPhoto(null);
    setErrors({});
  }

  if (done) {
    return (
      <main className="pad photo-form" aria-live="polite">
        <h1 className="h1">{t.doneTitle(name.trim())}</h1>
        <p className="photo-lede">{t.doneBody}</p>
        <button type="button" className="btn" onClick={another}>{t.another}</button>
      </main>
    );
  }

  return (
    <main className="pad">
      <form className="photo-form" onSubmit={onSubmit} noValidate>
        <div className="stack" style={{ gap: 8 }}>
          <h1 className="h1">{t.title}</h1>
          <p className="photo-lede">{t.lede}</p>
        </div>

        <div className="field">
          <label htmlFor="photo-name">{t.name}</label>
          <input id="photo-name" className="input" value={name} maxLength={60} autoComplete="name"
            aria-invalid={!!errors.name} aria-describedby={errors.name ? 'photo-name-err' : undefined}
            onChange={(e) => setName(e.target.value)} />
          {errors.name && <span id="photo-name-err" className="error">{errors.name}</span>}
        </div>

        <fieldset className="photo-topics" aria-describedby={errors.topic ? 'photo-topic-err' : undefined}>
          <legend className="legend">{t.topic}</legend>
          {topics.map((x) => (
            <label key={x.id} className="photo-topic" data-on={topic === x.id}>
              <input type="radio" name="topic" value={x.id} checked={topic === x.id} onChange={() => setTopic(x.id)} />
              <span className="photo-topic-text">
                <span className="photo-topic-name">{x.name}</span>
                <span className="photo-topic-hint">{x.hint}</span>
              </span>
            </label>
          ))}
          {errors.topic && <span id="photo-topic-err" className="error">{errors.topic}</span>}
        </fieldset>

        <div className="field">
          <span className="legend">{t.photo}</span>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- a local preview of the visitor's own file
            <img className="photo-preview" src={photo.url} alt={t.preview} />
          )}
          <label className="btn ghost photo-pick">
            <input className="sr-only" type="file" accept="image/*" disabled={preparing || uploading} onChange={onFile} />
            {preparing ? t.preparing : photo ? t.change : t.choose}
          </label>
          {errors.photo && <span className="error" role="alert">{errors.photo}</span>}
        </div>

        <p className="hint photo-notice">{t.notice} <Link href="/privacy">{t.privacy}</Link></p>
        {errors.form && <p className="error" role="alert" style={{ margin: 0 }}>{errors.form}</p>}
        <button type="submit" className="btn" disabled={uploading || preparing}>{uploading ? t.uploading : t.submit}</button>
      </form>
    </main>
  );
}
