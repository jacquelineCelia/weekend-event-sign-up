import { redirect } from 'next/navigation';
import { isStaff } from '@/lib/session';
import { eventName } from '@/lib/hans';
import { staffLang } from '@/lib/staff-lang';
import { sdict, staffHtmlLang } from '@/lib/staff-i18n';
import { Leaf } from '@/components/icons';
import { staffSignOutAction } from '../actions';
import StaffTabs from './StaffTabs';
import StaffLangSwitch from '../StaffLangSwitch';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  if (!(await isStaff())) redirect('/staff/login');
  const lang = await staffLang();
  const t = sdict(lang);
  return (
    <div className="staff" lang={staffHtmlLang(lang)}>
      <nav aria-label={t.staff} className="staffnav">
        <svg className="hill" viewBox="0 0 1440 68" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 56 C 240 38, 480 44, 720 54 S 1200 60, 1440 46 L1440 68 L0 68 Z" fill="#3B5644" />
        </svg>
        <span className="brand"><span style={{ color: 'var(--sun)', display: 'flex' }}><Leaf size={20} /></span> {eventName(lang)} · {t.staff}</span>
        <StaffTabs labels={[t.tabCheckIn, t.tabWalkIn, t.tabRegistration, t.tabSchedule]} />
        <StaffLangSwitch lang={lang} label={t.language} onDark />
        <form action={staffSignOutAction}><button type="submit">{t.signOut}</button></form>
      </nav>
      {children}
    </div>
  );
}
