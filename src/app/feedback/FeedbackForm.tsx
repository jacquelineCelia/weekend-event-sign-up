'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { Sprout } from '@/components/icons';
import { nameRuns } from '@/components/ActivityName';
import { dict, zhBold, type Lang } from '@/lib/i18n';
import { AGES, LEARN, SAT, SAT_GROUPS, type Age, type FeedbackStrings } from '@/lib/feedback-text';
import { sendFeedbackAction } from './actions';

// Kept in step with SCALES in src/lib/feedback.ts (that file talks to the database, so it isn't imported here).
const SCALES = ['relax', 'venue', 'guidance', 'transition', 'again'] as const;
type Scale = (typeof SCALES)[number];
const OPTIONAL: Scale[] = ['transition'];
const MAX_TEXT = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEPS = 4;

type Activity = { id: string; name: string; number: number };
type Prefill = { name: string; email: string; activityIds: string[] };

/** One 1–5 row: five large pills, optionally with the end labels under them. */
function Pills({ name, value, onPick, ariaLabel, ends }: { name: string; value?: number; onPick: (n: number) => void; ariaLabel: (n: number) => string; ends?: [string, string] }) {
  return (
    <>
      <div className="fb-pills">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="fb-pill" data-on={value === n}>
            <input className="sr-only" type="radio" name={name} value={n} checked={value === n} aria-label={ariaLabel(n)} onChange={() => onPick(n)} />
            <span aria-hidden="true">{n}</span>
          </label>
        ))}
      </div>
      {ends ? <div className="fb-ends" aria-hidden="true"><span>1 · {ends[0]}</span><span>5 · {ends[1]}</span></div> : null}
    </>
  );
}

function QHead({ num, children }: { num: string; children: ReactNode }) {
  return (
    <span className="fb-q">
      <span className="fb-qnum">{num}</span>
      {/* The text sits in its own box, so a wrapped line starts under the first character, not under the number. */}
      <span>{children}</span>
    </span>
  );
}

/**
 * Feedback form in four pages: about you (name, email, age) · the 法會 (questions 1–6) · satisfaction
 * with the 憶師恩法會 (7-1 … 7-11) · the weekend's activities (8, the earlier five questions) and a closing comment (9).
 * Everything stays in this one component, so going back and forth never loses an answer.
 */
export default function FeedbackForm({ lang, activities, prefill, text: f }: { lang: Lang; activities: Activity[]; prefill: Prefill; text: FeedbackStrings }) {
  const t = dict(lang).feedback;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [age, setAge] = useState<Age | null>(null);
  const [toGuru, setToGuru] = useState('');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [reflection, setReflection] = useState('');
  const [picked, setPicked] = useState<string[]>(prefill.activityIds);
  const [none, setNone] = useState(false);
  const [shown, setShown] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!shown.length) return;
    document.querySelector('[aria-invalid="true"], [data-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [shown]);
  useEffect(() => { window.scrollTo(0, 0); }, [step, done]);

  const has = (k: string) => shown.includes(k);
  const fix = (k: string) => setShown((x) => x.filter((y) => y !== k));
  const rate = (k: string) => (n: number) => { setRates((x) => ({ ...x, [k]: n })); fix(k); };

  /** What's missing on one page. */
  function missingOn(s: number): string[] {
    const m: string[] = [];
    if (s === 0) {
      if (!name.trim()) m.push('name');
      if (!EMAIL.test(email.trim())) m.push('email');
      if (!age) m.push('age');
    } else if (s === 1) {
      if (toGuru.length > MAX_TEXT) m.push('toGuru');
      for (const k of ['joy', ...LEARN]) if (!rates[k]) m.push(k);
    } else if (s === 2) {
      for (const k of SAT) if (!rates[k]) m.push(k);
    } else {
      if (!none) {
        if (!picked.length) m.push('activities');
        for (const k of SCALES) if (!rates[k] && !OPTIONAL.includes(k)) m.push(k);
      }
      if (reflection.length > MAX_TEXT) m.push('reflection');
    }
    return m;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const missing = missingOn(step);
    setShown(missing);
    if (missing.length) return;
    if (step < STEPS - 1) { setStep(step + 1); return; }

    const data = new FormData();
    data.set('name', name);
    data.set('email', email);
    data.set('age', age ?? '');
    data.set('toGuru', toGuru);
    data.set('reflection', reflection);
    for (const [k, v] of Object.entries(rates)) data.set(k, String(v));
    if (!none) for (const id of picked) data.append('activity', id);
    data.set('noActivities', none ? '1' : '');
    setFailed(false);
    startTransition(async () => {
      try {
        const res = await sendFeedbackAction(null, data);
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
  const last = step === STEPS - 1;
  return (
    <main className="pad">
      <form className="photo-form fb-form" onSubmit={onSubmit} noValidate>
        <div className="stack" style={{ gap: 8 }}>
          <h1 className="h1">{t.title}</h1>
          {step === 0 ? <p className="photo-lede">{t.lede}</p> : null}
        </div>

        {/* Progress: page n of 4 and the page's name, with four segments. */}
        <div className="fb-progress">
          <div className="fb-progress-text"><b>{f.steps[step]}</b><span>{f.stepLabels[step]}</span></div>
          <div className="fb-progress-bar" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, i) => <span key={i} data-on={i <= step} />)}
          </div>
        </div>

        {step === 0 ? (
          <>
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
            <fieldset className="fb-agefield" data-invalid={has('age')}>
              <legend className="legend">{f.age}</legend>
              <div className="fb-ages">
                {AGES.map((a) => (
                  <label key={a} className="fb-pill fb-age" data-on={age === a}>
                    <input className="sr-only" type="radio" name="age" value={a} checked={age === a} onChange={() => { setAge(a); fix('age'); }} />
                    <span>{f.ages[a]}</span>
                  </label>
                ))}
              </div>
              {has('age') && <span className="error">{f.errAge}</span>}
            </fieldset>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="field fb-card" data-invalid={has('toGuru')}>
              <label htmlFor="fb-guru" className="fb-comment-label"><QHead num="1">{f.q1} <span className="fb-note">{t.optional}</span></QHead></label>
              <textarea id="fb-guru" className="input fb-comment" rows={5} value={toGuru} maxLength={MAX_TEXT}
                aria-invalid={has('toGuru')} onChange={(e) => { setToGuru(e.target.value); fix('toGuru'); }} />
              {has('toGuru') && <span className="error">{t.errComment}</span>}
            </div>

            <div className="fb-card" data-invalid={has('joy')}>
              <fieldset className="fb-scale">
                <legend className="legend"><QHead num="2">{f.q2}</QHead></legend>
                <Pills name="joy" value={rates.joy} onPick={rate('joy')} ariaLabel={t.scoreAria} ends={f.q2ends} />
                {has('joy') && <span className="error">{t.errScore}</span>}
              </fieldset>
            </div>

            {/* 3–6 share one stem, so they sit together on one card, one row each. */}
            <div className="fb-card fb-group" data-invalid={LEARN.some(has)}>
              <p className="fb-group-stem">{f.learnStem}</p>
              <div className="fb-ends fb-group-ends" aria-hidden="true"><span>1 · {f.learnEnds[0]}</span><span>5 · {f.learnEnds[1]}</span></div>
              {LEARN.map((k, i) => (
                <div key={k} className="fb-row" data-invalid={has(k)}><fieldset className="fb-scale">
                  <legend className="legend"><QHead num={String(i + 3)}>{f.learn[k]}</QHead></legend>
                  <Pills name={k} value={rates[k]} onPick={rate(k)} ariaLabel={t.scoreAria} />
                  {has(k) && <span className="error">{t.errScore}</span>}
                </fieldset></div>
              ))}
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="fb-q fb-stem7">
              <span className="fb-qnum">7</span>
              <span className="stack" style={{ gap: 4 }}>
                <span>{f.q7}</span>
                <span className="fb-note">{f.scaleNote}</span>
              </span>
            </div>
            {SAT_GROUPS.map((g, gi) => (
              <div key={gi} className="fb-card fb-group" data-invalid={g.some(has)}>
                <p className="fb-group-stem">{f.satGroups[gi]}</p>
                <div className="fb-ends fb-group-ends" aria-hidden="true"><span>1 · {f.satEnds[0]}</span><span>5 · {f.satEnds[1]}</span></div>
                {g.map((k) => (
                  <div key={k} className="fb-row" data-invalid={has(k)}><fieldset className="fb-scale">
                    <legend className="legend"><QHead num={`7-${SAT.indexOf(k) + 1}`}>{f.sat[k]}</QHead></legend>
                    <Pills name={k} value={rates[k]} onPick={rate(k)} ariaLabel={t.scoreAria} />
                    {has(k) && <span className="error">{t.errScore}</span>}
                  </fieldset></div>
                ))}
              </div>
            ))}

          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="fb-q fb-stem7">
              <span className="fb-qnum">8</span>
              <span className="stack" style={{ gap: 4 }}>
                <span>{f.q8}</span>
                <span className="fb-note">{f.q8lede}</span>
              </span>
            </div>
            <fieldset className="photo-topics" data-invalid={has('activities')}>
              <legend className="legend">{t.activities} <span className="fb-note">{t.activitiesHint}</span></legend>
              {activities.map((a) => {
                const on = !none && picked.includes(a.id);
                return (
                  <label key={a.id} className="photo-topic" data-on={on}>
                    <input type="checkbox" checked={on}
                      onChange={() => { setNone(false); setPicked((x) => (on ? x.filter((y) => y !== a.id) : [...x, a.id])); fix('activities'); }} />
                    <span className="card-num" aria-hidden="true">{a.number}</span>
                    <span className={`photo-topic-name${zhBold(a.name)}`}>{nameRuns(a.name)}</span>
                  </label>
                );
              })}
              <label className="photo-topic fb-none" data-on={none}>
                <input type="checkbox" checked={none} onChange={() => { setNone(!none); setShown((x) => x.filter((y) => y === 'reflection')); }} />
                <span className="photo-topic-name">{f.noActivities}</span>
              </label>
              {has('activities') && <span className="error">{t.errActivities}</span>}
            </fieldset>

            {none ? <p className="fb-note" style={{ margin: 0, fontSize: 17 }}>{f.noActivitiesNote}</p> : SCALES.map((s, i) => {
              const q = t.questions[s];
              return (
                <div key={s} className="fb-card" data-invalid={has(s)}>
                  <fieldset className="fb-scale">
                    <legend className="legend"><QHead num={`8-${i + 1}`}>{q.q}{OPTIONAL.includes(s) ? <span className="fb-note"> {t.transitionHint}</span> : null}</QHead></legend>
                    <Pills name={s} value={rates[s]} onPick={rate(s)} ariaLabel={t.scoreAria} ends={[q.low, q.high]} />
                    {has(s) && <span className="error">{t.errScore}</span>}
                  </fieldset>
                </div>
              );
            })}
            <div className="field fb-card" data-invalid={has('reflection')}>
              <label htmlFor="fb-reflection" className="fb-comment-label"><QHead num="9">{f.q9} <span className="fb-note">{t.optional}</span></QHead></label>
              <textarea id="fb-reflection" className="input fb-comment" rows={5} value={reflection} maxLength={MAX_TEXT}
                aria-invalid={has('reflection')} onChange={(e) => { setReflection(e.target.value); fix('reflection'); }} />
              {has('reflection') && <span className="error">{t.errComment}</span>}
            </div>
            <p className="hint photo-notice">{t.notice} <Link href="/privacy">{t.privacy}</Link></p>
          </>
        ) : null}

        {fieldErrors.length ? <p className="error" role="alert" style={{ margin: 0 }}>{t.errSummary}</p> : null}
        {has('busy') ? <p className="error" role="alert" style={{ margin: 0 }}>{t.errBusy}</p> : null}
        {failed ? <p className="error" role="alert" style={{ margin: 0 }}>{t.errFailed}</p> : null}
        <div className="fb-nav">
          {step > 0 ? <button type="button" className="btn ghost" onClick={() => { setShown([]); setStep(step - 1); }}>{f.back}</button> : null}
          <button type="submit" className="btn" disabled={pending}>{last ? (pending ? t.sending : t.submit) : f.next}</button>
        </div>
      </form>
    </main>
  );
}
