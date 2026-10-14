import { redirect } from 'next/navigation';
import { isStaff } from '@/lib/session';
import { EVENT } from '@/lib/event';
import { Leaf } from '@/components/icons';
import { staffSignOutAction } from '../actions';
import StaffTabs from './StaffTabs';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  if (!(await isStaff())) redirect('/staff/login');
  return (
    <div className="staff" lang="en">
      <nav aria-label="Staff" className="staffnav">
        <svg className="hill" viewBox="0 0 1440 68" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 56 C 240 38, 480 44, 720 54 S 1200 60, 1440 46 L1440 68 L0 68 Z" fill="#3B5644" />
        </svg>
        <span className="brand"><span style={{ color: 'var(--sun)', display: 'flex' }}><Leaf size={20} /></span> {EVENT.name} · Staff</span>
        <StaffTabs />
        <form action={staffSignOutAction}><button type="submit">Sign out</button></form>
      </nav>
      {children}
    </div>
  );
}
