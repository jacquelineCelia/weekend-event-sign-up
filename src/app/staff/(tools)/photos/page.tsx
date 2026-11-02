import { headers } from 'next/headers';
import { photoFeed } from '@/lib/photos';
import { staffLang } from '@/lib/staff-lang';
import PhotoShow from './PhotoShow';

export const dynamic = 'force-dynamic';

export default async function PhotosTab() {
  const lang = await staffLang();
  const host = (await headers()).get('host') ?? '';
  return <PhotoShow initial={await photoFeed(lang)} lang={lang} uploadAddress={`${host}/photos`} />;
}
