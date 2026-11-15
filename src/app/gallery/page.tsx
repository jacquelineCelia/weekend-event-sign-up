import Link from 'next/link';
import { Back, Camera } from '@/components/icons';
import LangToggle from '@/components/LangToggle';
import { dict } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { galleryPhotos, photoTopics } from '@/lib/photos';
import Gallery from './Gallery';

export const dynamic = 'force-dynamic';

/**
 * Public photo gallery: every shared photo, newest first, with topic chips (All + the nine topics,
 * each with its count) kept in the address as ?topic=<id>. Tapping a photo opens it full screen.
 */
export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const lang = await getLang();
  const t = dict(lang);
  const g = t.gallery;
  const [topics, photos] = await Promise.all([photoTopics(lang), galleryPhotos(lang)]);
  const sp = await searchParams;
  const current = topics.some((x) => x.id === sp.topic) ? sp.topic! : null;
  const shown = current ? photos.filter((p) => p.topicId === current) : photos;
  const count = (id: string) => photos.filter((p) => p.topicId === id).length;

  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href="/"><Back /> {t.allActivities}</Link>
        <LangToggle lang={lang} />
      </div>
      <main className="pad gallery">
        <div className="stack" style={{ gap: 8 }}>
          <h1 className="h1">{g.title}</h1>
          <p className="photo-lede">{g.lede}</p>
        </div>
        <Link className="btn ghost gallery-share" href="/photos"><Camera /> {g.share}</Link>

        <nav className="gallery-topics" aria-label={g.topicsAria}>
          <Link href="/gallery" scroll={false} className="gallery-chip" aria-current={current ? undefined : 'true'}>
            {g.all} <span className="gallery-chip-n">{photos.length}</span>
          </Link>
          {topics.map((x) => (
            <Link key={x.id} href={`/gallery?topic=${x.id}`} scroll={false} className="gallery-chip" aria-current={current === x.id ? 'true' : undefined}>
              {x.name} <span className="gallery-chip-n">{count(x.id)}</span>
            </Link>
          ))}
        </nav>

        {current ? <p className="gallery-hint">{topics.find((x) => x.id === current)!.hint}</p> : null}
        <p className="gallery-count" aria-live="polite">{g.count(shown.length)}</p>

        {shown.length ? (
          <Gallery key={current ?? 'all'} photos={shown} showTopic={!current} lang={lang} />
        ) : (
          <p className="empty">{photos.length ? g.emptyTopic : g.empty}</p>
        )}
      </main>
    </div>
  );
}
