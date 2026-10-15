import type { Metadata, Viewport } from 'next';
import { eventName } from '@/lib/hans';
import '@fontsource/young-serif/400.css';
import '@fontsource-variable/figtree';
import './globals.css';
import { headers } from 'next/headers';
import { EVENT } from '@/lib/event';
import { getLang } from '@/lib/lang';
import { dict } from '@/lib/i18n';

/** Attendee screens have their own English and Chinese, so browser machine translation is off
 *  there (it mangles things, e.g. "1 spot" → "1 位元"). Staff screens can still be translated. */
const isStaffArea = async () => (await headers()).get('x-mw-area') === 'staff';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  const noTranslate: Metadata = (await isStaffArea()) ? {} : { other: { google: 'notranslate' } };
  if (lang === 'zh') return { title: `${EVENT.nameZh} · 活動報名`, description: '報名活動、選擇時段，並在開始前 15 分鐘收到提醒。', ...noTranslate };
  if (lang === 'zhs') return { title: `${eventName('zhs')} · 活动报名`, description: '报名活动、选择时段，并在开始前 15 分钟收到提醒。', ...noTranslate };
  return { title: `${EVENT.name} · Activities`, description: 'Sign up for activities, pick a time, and get a reminder 15 minutes before.', ...noTranslate };
}

export const viewport: Viewport = { themeColor: '#2a3d31', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const staff = await isStaffArea();
  return (
    <html lang={dict(lang).htmlLang} translate={staff ? undefined : 'no'} className={staff ? undefined : 'notranslate'}>
      <body>{children}</body>
    </html>
  );
}
