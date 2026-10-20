import Link from 'next/link';
import { Back } from '@/components/icons';
import LangToggle from '@/components/LangToggle';
import { dict } from '@/lib/i18n';
import { EVENT, type Lang } from '@/lib/event';
import type { LegalDoc } from '@/lib/legal';

/** Shared layout for the Terms and Privacy pages: public, no sign-in, in the reader's language. */
export default function LegalPage({ lang, doc }: { lang: Lang; doc: LegalDoc }) {
  const t = dict(lang);
  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href="/"><Back /> {t.allActivities}</Link>
        <LangToggle lang={lang} />
      </div>
      <article className="legal">
        <h1 className="h1" style={{ fontSize: 30, margin: '6px 0 4px' }}>{doc.title}</h1>
        <p className="muted" style={{ fontSize: 13 }}>{doc.updated}</p>
        {doc.note ? <p className="muted" style={{ fontSize: 13 }}>{doc.note}</p> : null}
        <p>{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((x, i) => Array.isArray(x)
              ? <ul key={i}>{x.map((li) => <li key={li}>{li}</li>)}</ul>
              : <p key={i}>{x}</p>)}
          </section>
        ))}
      </article>
      <LegalFoot lang={lang} />
    </div>
  );
}

export function LegalFoot({ lang }: { lang: Lang }) {
  const t = dict(lang);
  return (
    <footer className="legalfoot">
      <p className="org">{t.organizedBy(EVENT.org, EVENT.parentOrg)}</p>
      <p className="links"><Link href="/terms">{t.terms}</Link><span aria-hidden="true">·</span><Link href="/privacy">{t.privacy}</Link></p>
    </footer>
  );
}
