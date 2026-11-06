'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { Sprout } from '@/components/icons';
import { nameRuns } from '@/components/ActivityName';
import { dict, zhBold, type Lang } from '@/lib/i18n';
import { sendFeedbackAction } from './actions';

// Kept in step with SCALES in src/lib/feedback.ts (that file talks to the database, so it isn't imported here).
const SCALES = ['relax', 'venue', 'guidance', 'transition', 'again'] as const;
type Scale = (typeof SCALES)[number];
const OPTIONAL: Scale[] = ['transition'];
const MAX_COMMENT = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Activity = { id: string; name: string; number: number };
type Prefill = { name: string; email: string; activityIds: string[] };

/**
 * Feedback on the whole weekend. Every input is controlled and the form is sent through onSubmit, so a
 * refused send never resets what was already filled in.
 */
export default function FeedbackForm({ lang, event, activities, prefill }: { lang: Lang; event: string; activities: Activity[]; prefill: Prefill }) {
  const t = dict(lang).feedback;
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [picked, setPicked] = useState<string[]>(prefill.activityIds);
  const [scores, setScores] = useState<Partial<Record<Scale, number>>>({});
  const [comment, setComment] = useState('');
  const [shown, setShown] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!shown.length) return;
    document.querySelector('[aria-invalid="true"], [data-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [shown]);
  useEffect(() => { if (done) window.scrollTo(0, 0); }, [done]);

  const has = (k: string) => shown.includes(k);
  const fix = (k: string) => setShown((x) => x.filter((y) => y !== k));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const missing: string[] = [];
    if (!name.trim()) missing.push('name');
    if (!EMAIL.test(email.trim())) missing.push('email');
    if (!picked.length) missing.push('activities');
    for (const s of SCALES) if (!scores[s] && !OPTIONAL.includes(s)) missing.push(s);
    if (comment.length > MAX_COMMENT) missing.push('comment');
    setShown(missing);
    if (missing.length) return;
    const data = new FormData();
    data.set('name', name);
    data.set('email', email);
    for (const id of picked) data.append('activity', id);
    for (const s of SCALES) if (scores[s]) data.set(s, String(scores[s]));
    data.set('comment', comment);
    setFailed(false);
    startTransition(async () => {
      try {
        const res = await sendFeedbackAction(null, data);
        // Problems found by the server replace the ones found here.
        if (res?.done) setDone(true);
        else setShown(res?.errors ?? []);
      } catch {
        setFailed(true);
      }
    });
  }

  if (done) {
    return (
      <main className="pad photo-form photo-done" aria-live="polite">
        <span className="leafmark" style={{ alignSelf: 'center' }}><Sprout /></span>
        <h1 className="h1">{t.doneTitle(name.trim())}</h1>
        <p className="photo-lede">{t.doneBody}</p>
        <Link className="btn" href="/">{t.backToList}</Link>
      </main>
    );
  }

  const fieldErrors = shown.filter((x) => x !== 'busy');
  return (
    <main className="pad">
      <form className="photo-form fb-form" onSubmit={onSubmit} noValidate>
        <div className="stack" style={{ gap: 8 }}>
          <h1 className="h1">{t.title}</h1>
          <p className="photo-lede">{t.lede(event)}</p>
        </div>

        <div className="field">
          <label htmlFor="fb-name">{t.name}</label>
          <input id="fb-name" className="input" value={name} maxLength={60} autoComplete="name"
            aria-invalid={has('name')} onChange={(e) => { setName(e.target.value); fix('name'); }} />
          {has('name') && <span className="error">{t.errName}</span>}
        </div>
        <div className="field">
          <label htmlFor="fb-email">{t.email}</label>
          <input id="fb-email" className="input" type="email" inputMode="email" value={email} maxLength={120} autoComplete="email"
            aria-invalid={has('email')} onChange={(e) => { setEmail(e.target.value); fix('email'); }} />
          {has('email') && <span className="error">{t.errEmail}</span>}
        </div>

        <fieldset className="photo-topics" data-invalid={has('activities')}>
          <legend className="legend">{t.activities} <span className="fb-note">{t.activitiesHint}</span></legend>
          {activities.map((a) => {
            const on = picked.includes(a.id);
            return (
              <label key={a.id} className="photo-topic" data-on={on}>
                <input type="checkbox" checked={on}
                  onChange={() => { setPicked((x) => (on ? x.filter((y) => y !== a.id) : [...x, a.id])); fix('activities'); }} />
                <span className="card-num" aria-hidden="true">{a.number}</span>
                <span className={`photo-topic-name${zhBold(a.name)}`}>{nameRuns(a.name)}</span>
              </label>
            );
          })}
          {has('activities') && <span className="error">{t.errActivities}</span>}
        </fieldset>

        {SCALES.map((s, i) => {
          const q = t.questions[s];
          return (
            <fieldset key={s} className="fb-scale" data-invalid={has(s)}>
              <legend className="legend fb-q">
                <span className="fb-qnum">{i + 1}</span>
                {/* The text sits in its own box, so a wrapped line starts under the first character, not under the number. */}
                <span>{q.q}{OPTIONAL.includes(s) ? <span className="fb-note"> {t.transitionHint}</span> : null}</span>
              </legend>
              <div className="fb-pills">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="fb-pill" data-on={scores[s] === n}>
                    <input className="sr-only" type="radio" name={s} value={n} checked={scores[s] === n} aria-label={t.scoreAria(n)}
                      onChange={() => { setScores((x) => ({ ...x, [s]: n })); fix(s); }} />
                    <span aria-hidden="true">{n}</span>
                  </label>
                ))}
              </div>
              <div className="fb-ends" aria-hidden="true"><span>1 · {q.low}</span><span>5 · {q.high}</span></div>
              {has(s) && <span className="error">{t.errScore}</span>}
            </fieldset>
          );
        })}

        <div className="field">
          <label htmlFor="fb-comment" className="fb-comment-label">{t.comment} <span className="fb-note">{t.optional}</span></label>
          <textarea id="fb-comment" className="input fb-comment" rows={5} value={comment} maxLength={MAX_COMMENT}
            aria-invalid={has('comment')} onChange={(e) => { setComment(e.target.value); fix('comment'); }} />
          {has('comment') && <span className="error">{t.errComment}</span>}
        </div>

        <p className="hint photo-notice">{t.notice} <Link href="/privacy">{t.privacy}</Link></p>
        {fieldErrors.length ? <p className="error" role="alert" style={{ margin: 0 }}>{t.errSummary}</p> : null}
        {has('busy') ? <p className="error" role="alert" style={{ margin: 0 }}>{t.errBusy}</p> : null}
        {failed ? <p className="error" role="alert" style={{ margin: 0 }}>{t.errFailed}</p> : null}
        <button type="submit" className="btn" disabled={pending}>{pending ? t.sending : t.submit}</button>
      </form>
    </main>
  );
}
