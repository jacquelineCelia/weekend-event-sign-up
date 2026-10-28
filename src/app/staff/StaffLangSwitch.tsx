'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { STAFF_LANGS } from '@/lib/staff-i18n';
import type { Lang } from '@/lib/event';
import { setStaffLangAction } from './actions';

/** EN | 繁中 | 简中 for the staff screens. Remembered on this device; the page re-renders in place. */
export default function StaffLangSwitch({ lang, label, onDark = false }: { lang: Lang; label: string; onDark?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={label} className={`langsw${onDark ? ' dark' : ''}`} aria-busy={pending}>
      {STAFF_LANGS.map((l) => (
        <button key={l.key} type="button" lang={l.htmlLang} aria-pressed={l.key === lang} disabled={pending}
          onClick={() => start(async () => { await setStaffLangAction(l.key); router.refresh(); })}>
          {l.label}
        </button>
      ))}
    </div>
  );
}
