import type { Metadata, Viewport } from 'next';
import '@fontsource/young-serif/400.css';
import '@fontsource-variable/figtree';
import './globals.css';
import { EVENT } from '@/lib/event';
import { getLang } from '@/lib/lang';
import { dict } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await getLang()) === 'zh';
  return zh
    ? { title: `${EVENT.nameZh} · 活動報名`, description: '報名活動、選擇時段，並在開始前 15 分鐘收到提醒。' }
    : { title: `${EVENT.name} · Activities`, description: 'Sign up for activities, pick a time, and get a reminder 15 minutes before.' };
}

export const viewport: Viewport = { themeColor: '#2a3d31', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={dict(lang).htmlLang}>
      <body>{children}</body>
    </html>
  );
}
