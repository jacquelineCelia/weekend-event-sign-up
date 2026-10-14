import Link from 'next/link';
import { Back } from '@/components/icons';
import { AskForm, CodeForm } from './forms';
import { getLang } from '@/lib/lang';
import { dict } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';

export const dynamic = 'force-dynamic';

export default async function SignIn({ searchParams }: { searchParams: Promise<{ t?: string; to?: string; via?: string; m?: string }> }) {
  const sp = await searchParams;
  const step = sp.t ? 'code' : 'ask';
  const lang = await getLang();
  return (
    <div className="phone">
      <div className="topbar">
        <span className="side"><Link className="back" href="/"><Back /> <span className="lbl">{dict(lang).activities}</span></Link></span>
        <LangToggle lang={lang} />
        <span className="side end" />
      </div>
      {step === 'ask' ? <AskForm lang={lang} /> : <CodeForm lang={lang} ticket={sp.t!} to={sp.to ?? ''} many={sp.m === '1'} via={sp.via === 'sms' ? 'sms' : 'email'} />}
    </div>
  );
}
