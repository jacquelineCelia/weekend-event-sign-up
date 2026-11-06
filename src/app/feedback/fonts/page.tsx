// TEMPORARY: a side-by-side preview of Chinese fonts for the feedback page, for the organizers to choose
// from on their phones. Not linked anywhere. Remove this page (and the three font packages) once a font
// is chosen.
import '@fontsource/lxgw-wenkai-tc/400.css';
import '@fontsource/lxgw-wenkai-tc/700.css';
import '@fontsource/iansui/400.css';
import '@fontsource/huninn/400.css';
import '@fontsource/noto-serif-tc/400.css';
import '@fontsource/noto-serif-tc/600.css';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { dict } from '@/lib/i18n';
import { eventName } from '@/lib/hans';

export const metadata: Metadata = { robots: { index: false } };

type Option = { key: string; label: string; note: string; family: string | null; weight: number };

const OPTIONS: Option[] = [
  { key: 'now', label: '目前（系統黑體）', note: 'PingFang / Noto Sans, the font the page uses now', family: null, weight: 600 },
  { key: 'wenkai', label: 'A · 霞鶩文楷 TC', note: 'LXGW WenKai TC: gentle hand-written 楷書', family: "'LXGW WenKai TC'", weight: 700 },
  { key: 'iansui', label: 'B · 芫荽', note: 'Iansui: light, airy hand-writing (one weight only)', family: "'Iansui'", weight: 400 },
  { key: 'huninn', label: 'C · 粉圓', note: 'Huninn: soft rounded sans (one weight only)', family: "'Huninn'", weight: 400 },
  { key: 'serif', label: 'D · 思源宋體', note: 'Noto Serif TC: quiet serif, already used for headings', family: "'Noto Serif TC'", weight: 600 },
];

const QUESTIONS = ['relax', 'guidance'] as const;

export default function FontPreview() {
  const t = dict('zh').feedback;
  return (
    <div className="phone">
      <main className="pad" style={{ paddingTop: 20, paddingBottom: 40, display: 'grid', gap: 36 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="h1" style={{ fontSize: 26 }}>字型預覽</h1>
          <p className="hint" style={{ fontSize: 15 }}>The same part of the feedback page in each font. Scroll to compare, then tell Claude A, B, C or D (or keep the current one).</p>
        </div>
        {OPTIONS.map((o) => {
          const font: CSSProperties = o.family
            ? ({ fontFamily: `${o.family}, var(--sans)`, '--serif': `${o.family}, serif`, fontSynthesisWeight: 'none' } as CSSProperties)
            : {};
          return (
            <section key={o.key} style={{ display: 'grid', gap: 14 }}>
              <div style={{ borderBottom: '2px solid var(--moss)', paddingBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 19, color: 'var(--moss-dark)' }}>{o.label}</div>
                <div className="hint" style={{ fontSize: 14 }}>{o.note}</div>
              </div>
              <div className="fb-form" style={{ display: 'grid', gap: 16, ...font }}>
                <div className="stack" style={{ gap: 8 }}>
                  <div className="h1">{t.title}</div>
                  <p className="photo-lede">{t.lede(eventName('zh'))}</p>
                </div>
                {QUESTIONS.map((q, i) => (
                  <div key={q} className="fb-card">
                    <div className="fb-scale">
                      <div className="legend fb-q" style={{ fontWeight: o.weight }}>
                        <span className="fb-qnum">{i === 0 ? 1 : 3}</span>
                        <span>{t.questions[q].q}</span>
                      </div>
                      <div className="fb-pills" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((n) => <span key={n} className="fb-pill" data-on={n === 4}>{n}</span>)}
                      </div>
                      <div className="fb-ends"><span>1 · {t.questions[q].low}</span><span>5 · {t.questions[q].high}</span></div>
                    </div>
                  </div>
                ))}
                <div className="fb-card" style={{ fontSize: 18, lineHeight: 1.45, fontWeight: o.weight }}>{t.comment}</div>
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
