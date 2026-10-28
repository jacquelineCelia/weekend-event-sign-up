'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const HREFS = ['/staff', '/staff/walk-in', '/staff/registration', '/staff/schedule'] as const;

/** The staff tabs; labels come from the server in the staff's language (same order as HREFS). */
export default function StaffTabs({ labels }: { labels: string[] }) {
  const path = usePathname();
  return (
    <div className="tabs">
      {HREFS.map((href, i) => (
        <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>{labels[i]}</Link>
      ))}
    </div>
  );
}
