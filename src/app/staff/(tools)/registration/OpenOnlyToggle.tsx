'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * "Only activities with openings" on the Registration page; kept in the address as ?open=1.
 * Ticks at once while the page reloads (the page gives it key={checked}, so it resets to the server's value).
 */
export default function OpenOnlyToggle({ checked, label }: { checked: boolean; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [on, setOn] = useState(checked);
  return (
    <label className="check" style={{ fontSize: 18 }}>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked);
          const q = new URLSearchParams(params.toString());
          if (e.target.checked) q.set('open', '1');
          else q.delete('open');
          const qs = q.toString();
          router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
        }}
      />
      {label}
    </label>
  );
}
