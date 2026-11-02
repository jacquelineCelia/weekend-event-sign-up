import Link from 'next/link';
import { Back } from '@/components/icons';
import LangToggle from '@/components/LangToggle';
import { dict } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { photoTopics } from '@/lib/photos';
import PhotoForm from './PhotoForm';

export const dynamic = 'force-dynamic';

export default async function Photos() {
  const lang = await getLang();
  const t = dict(lang);
  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href="/"><Back /> {t.allActivities}</Link>
        <LangToggle lang={lang} />
      </div>
      <PhotoForm lang={lang} topics={await photoTopics(lang)} />
    </div>
  );
}
