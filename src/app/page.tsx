import Link from 'next/link';
import { activitiesForDay } from '@/lib/queries';
import { EVENT, dayByKey, dayText, fmtDurationL, fmtTimeL, isLow, requestTime } from '@/lib/event';
import { getLang } from '@/lib/lang';
import { dict } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import { Calendar, Hills, Leaf, Check } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function Browse({ searchParams }: { searchParams: Promise<{ day?: string; open?: string }> }) {
  const sp = await searchParams;
  const day = dayByKey(sp.day);
  const onlyOpen = sp.open === '1';
  const lang = await getLang();
  const t = dict(lang);
  const all = await activitiesForDay(day.date, lang);
  const [title1, title2] = t.heroTitle(lang === 'zh' ? EVENT.nameZh : EVENT.name);
  const now = requestTime();

  const acts = all
    .map((a) => {
      const upcoming = a.slots.filter((s) => s.startsAt.getTime() > now);
      return { ...a, open: upcoming.filter((s) => s.remaining > 0), hasSlots: a.slots.length > 0 };
    })
    .filter((a) => a.hasSlots)
    .filter((a) => !onlyOpen || a.open.length > 0);

  const href = (q: { day?: string; open?: boolean }) => {
    const p = new URLSearchParams();
    p.set('day', q.day ?? day.key);
    if (q.open ?? onlyOpen) p.set('open', '1');
    return `/?${p}`;
  };
  const total = all.filter((a) => a.slots.length > 0).length;

  return (
    <div className="phone">
      <header className="hero">
        <div className="meta">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Leaf /> {lang === 'zh' ? EVENT.dateRangeZh : EVENT.dateRange}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <LangToggle lang={lang} onDark />
            <Link href="/me"><Calendar /> {t.mySignups}</Link>
          </span>
        </div>
        <h1>{title1}<br />{title2}</h1>
        <p>{t.heroLede}</p>
        <Hills />
      </header>

      <div className="filterbar">
        <nav className="segment" aria-label={t.dayNav}>
          {EVENT.days.map((d) => (
            <Link key={d.key} href={href({ day: d.key })} aria-current={d.key === day.key ? 'true' : undefined}>{dayText(d, 'label', lang)}</Link>
          ))}
        </nav>
        <div className="filterrow">
          <Link className="toggle-link" href={href({ open: !onlyOpen })} role="switch" aria-checked={onlyOpen}>
            <span className="box" data-on={onlyOpen}>{onlyOpen ? <Check /> : null}</span>
            {t.hasOpen}
          </Link>
          <span className="muted" aria-live="polite" style={{ fontSize: 13 }}>
            {acts.length === total ? t.countAll(total) : t.countSome(acts.length, total)}
          </span>
        </div>
      </div>

      <main className="list" aria-label={t.activities}>
        {acts.map((a) => (
          <section key={a.id} className="card" aria-labelledby={`a-${a.id}`}>
            <div className="card-head">
              <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                <Link id={`a-${a.id}`} className="card-title" href={`/activity/${a.id}?day=${day.key}`}>{a.name}</Link>
                <span className="card-sub">{a.place} · {fmtDurationL(a.durationMin, lang)}</span>
              </div>
              {a.open.length === 0 ? <span className="badge">{t.fullyBooked}</span> : null}
            </div>
            {a.open.length > 0 ? (
              <div className="chips">
                {a.open.map((s) => {
                  const low = isLow(s.remaining, s.capacity);
                  return (
                    <Link key={s.id} className={`chip ${low ? 'low' : 'open'}`} href={`/activity/${a.id}?day=${day.key}&slot=${s.id}`}
                      aria-label={t.chipAria(a.name, fmtTimeL(s.startsAt, lang), s.remaining)}>
                      <b>{fmtTimeL(s.startsAt, lang)}</b>
                      <span>{low ? t.onlyLeft(s.remaining) : t.left(s.remaining)}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </section>
        ))}
        {acts.length === 0 ? <p className="empty">{t.dayFull}</p> : null}
      </main>
    </div>
  );
}
