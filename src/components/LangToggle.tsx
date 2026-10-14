'use client';

import { useTransition } from 'react';
import { setLangAction } from '@/app/lang-actions';
import type { Lang } from '@/lib/i18n';

/**
 * EN | 繁中 switch. Switching re-renders the page in place, so a half-filled form,
 * the chosen time and a running hold are all kept.
 */
export default function LangToggle({ lang, onDark = false }: { lang: Lang; onDark?: boolean }) {
  const [pending, start] = useTransition();
  const opt = (l: Lang, label: string, aria: string) => (
    <button type="button" lang={l === 'zh' ? 'zh-Hant-TW' : 'en'} aria-pressed={lang === l} aria-label={aria}
      disabled={pending} onClick={() => lang !== l && start(() => setLangAction(l))}>
      {label}
    </button>
  );
  return (
    <div className="langtoggle" data-dark={onDark} role="group" aria-label="Language / 語言">
      {opt('en', 'EN', 'English')}
      {opt('zh', '繁中', '繁體中文')}
    </div>
  );
}
