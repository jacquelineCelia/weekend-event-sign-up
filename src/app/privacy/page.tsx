import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';
import { getLang } from '@/lib/lang';
import { eventName } from '@/lib/hans';
import { privacy } from '@/lib/legal';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return { title: `${privacy(lang, eventName(lang)).title} · ${eventName(lang)}` };
}

export default async function Page() {
  const lang = await getLang();
  return <LegalPage lang={lang} doc={privacy(lang, eventName(lang))} />;
}
