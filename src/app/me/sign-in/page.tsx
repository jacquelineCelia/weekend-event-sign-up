import Link from 'next/link';
import { Back } from '@/components/icons';
import { AskForm, CodeForm } from './forms';

export const dynamic = 'force-dynamic';

export default async function SignIn({ searchParams }: { searchParams: Promise<{ t?: string; to?: string; via?: string }> }) {
  const sp = await searchParams;
  const step = sp.t ? 'code' : 'ask';
  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href="/"><Back /> Activities</Link>
      </div>
      {step === 'ask' ? <AskForm /> : <CodeForm ticket={sp.t!} to={sp.to ?? ''} via={sp.via === 'sms' ? 'sms' : 'email'} />}
    </div>
  );
}
