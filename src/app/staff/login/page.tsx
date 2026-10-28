import { redirect } from 'next/navigation';
import { isStaff } from '@/lib/session';
import { eventName } from '@/lib/hans';
import { staffLang } from '@/lib/staff-lang';
import { sdict, staffHtmlLang } from '@/lib/staff-i18n';
import LoginForm from './LoginForm';
import StaffLangSwitch from '../StaffLangSwitch';

export const dynamic = 'force-dynamic';

export default async function StaffLogin() {
  if (await isStaff()) redirect('/staff');
  const lang = await staffLang();
  const t = sdict(lang);
  return (
    <div className="phone" lang={staffHtmlLang(lang)} style={{ justifyContent: 'center' }}>
      <div className="pad stack" style={{ gap: 18, padding: '40px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="eyebrow">{eventName(lang)} · {t.staff}</span>
          <StaffLangSwitch lang={lang} label={t.language} />
        </div>
        <h1 className="h1">{t.signInTitle}</h1>
        <p className="lede">{t.signInLede}</p>
        <LoginForm lang={lang} />
      </div>
    </div>
  );
}
