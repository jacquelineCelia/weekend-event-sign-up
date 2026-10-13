'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/staff', label: 'Check-in' },
  { href: '/staff/walk-in', label: 'Walk-in sign-up' },
  { href: '/staff/schedule', label: 'Schedule & capacity' },
];

export default function StaffTabs() {
  const path = usePathname();
  return (
    <div className="tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? 'page' : undefined}>{t.label}</Link>
      ))}
    </div>
  );
}
