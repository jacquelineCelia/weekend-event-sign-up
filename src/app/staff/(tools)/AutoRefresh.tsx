'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Keeps several staff tablets in sync by re-fetching the page data every few seconds. */
export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
