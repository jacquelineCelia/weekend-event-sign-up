import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { getLang } from '@/lib/lang';
import { eventName } from '@/lib/hans';
import { terms } from '@/lib/legal';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${terms(lang, eventName(lang)).title} · ${eventName(lang)}` };
}

export default async function Page() {
  const lang = await getLang();
  return <LegalPage lang={lang} doc={terms(lang, eventName(lang))} />;
}
