'use client';

import { useState, useTransition } from 'react';
import { Sprout } from '@/components/icons';
import { dict, type Lang } from '@/lib/i18n';
import { rateByLinkAction } from './actions';

/** The two per-activity questions, saved one tap at a time. Answers can be changed freely. */
export default function RateForm({ token, lang, calm: calm0, again: again0 }: { token: string; lang: Lang; calm: number | null; again: boolean | null }) {
  const t = dict(lang);
  const [calm, setCalm] = useState(calm0);
  const [again, setAgain] = useState(again0);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  function save(name: 'calm' | 'again', value: string, undo: () => void) {
    const data = new FormData();
    data.set(name, value);
    setFailed(false);
    startTransition(async () => {
      try {
        const r = await rateByLinkAction(token, data);
        if (!r.ok) throw new Error('not saved');
      } catch {
        undo();
        setFailed(true);
      }
    });
  }

  const done = calm !== null && again !== null;
  return (
    <div className="fb-form" style={{ display: 'grid', gap: 18 }}>
      <div className="fb-card">
        <fieldset className="fb-scale">
          <legend className="legend">{t.calmQ}</legend>
          <div className="fb-pills">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="fb-pill" data-on={calm === n}>
                <input className="sr-only" type="radio" name="calm" value={n} checked={calm === n} aria-label={t.calmAria(n)}
                  onChange={() => { const before = calm; setCalm(n); save('calm', String(n), () => setCalm(before)); }} />
                <span aria-hidden="true">{n}</span>
              </label>
            ))}
          </div>
          <div className="fb-ends" aria-hidden="true"><span>{t.calmLow}</span><span>{t.calmHigh}</span></div>
        </fieldset>
      </div>
      <div className="fb-card">
        <fieldset className="fb-scale">
          <legend className="legend">{t.againQ}</legend>
          <div className="fb-pills" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {([['yes', true, t.againYes], ['no', false, t.againNo]] as const).map(([v, b, label]) => (
              <label key={v} className="fb-pill" data-on={again === b}>
                <input className="sr-only" type="radio" name="again" value={v} checked={again === b}
                  onChange={() => { const before = again; setAgain(b); save('again', v, () => setAgain(before)); }} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {failed ? <p className="error" role="alert" style={{ margin: 0 }}>{t.feedback.errFailed}</p> : null}
      {done ? (
        <div className="rate-thanks" role="status">
          <span className="leafmark"><Sprout /></span>
          <div className="stack" style={{ gap: 4 }}>
            <strong style={{ fontSize: 18 }}>{t.ratePage.thanks}</strong>
            <span className="hint" style={{ fontSize: 15 }}>{t.ratePage.thanksBody}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
