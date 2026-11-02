import Link from 'next/link';
import { activitiesAllDays } from '@/lib/queries';
import { eventName } from '@/lib/hans';
import { LegalFoot } from '@/components/LegalPage';
import { EVENT, dateRangeL, dayOf, dayText, fmtDayTimeL, fmtTimeL, isLow, requestTime } from '@/lib/event';
import { getLang } from '@/lib/lang';
import { dict, zhBold } from '@/lib/i18n';
import LangToggle from '@/components/LangToggle';
import { Calendar, Hills, Leaf, Check } from '@/components/icons';
import { nameRuns } from '@/components/ActivityName';

export const dynamic = 'force-dynamic';

export default async function Browse({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const sp = await searchParams;
  const onlyOpen = sp.open === '1';
  const lang = await getLang();
  const t = dict(lang);
  // Every activity has only a few times over the weekend, so both days show on one list.
  const all = await activitiesAllDays(lang);
  const [title1, title2] = t.heroTitle(eventName(lang));
  const now = requestTime();

  const acts = all
    .map((a) => {
      const upcoming = a.slots.filter((s) => s.startsAt.getTime() > now);
      return { ...a, upcoming, open: upcoming.filter((s) => s.remaining > 0), hasSlots: a.slots.length > 0 };
    })
    .filter((a) => a.hasSlots)
    .filter((a) => !onlyOpen || a.open.length > 0);

  const href = (q: { open: boolean }) => (q.open ? '/?open=1' : '/');
  const total = all.filter((a) => a.slots.length > 0).length;

  return (
    <div className="phone">
      <header className="hero">
        <div className="meta">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}><Leaf /> {dateRangeL(lang)}</span>
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
        <div className="filterrow">
          <Link className="toggle-link" href={href({ open: !onlyOpen })} role="switch" aria-checked={onlyOpen}>
            <span className="box" data-on={onlyOpen}>{onlyOpen ? <Check /> : null}</span>
            {t.hasOpen}
          </Link>
          <span className="muted" aria-live="polite" style={{ fontSize: 14.5 }}>
            {acts.length === total ? t.countAll(total) : t.countSome(acts.length, total)}
          </span>
        </div>
      </div>

      <main className="list" aria-label={t.activities}>
        {acts.map((a) => (
          <section key={a.id} className="card" aria-labelledby={`a-${a.id}`}>
            <div className="card-head">
              <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                <Link id={`a-${a.id}`} className={`card-title${zhBold(a.name)}`} href={`/activity/${a.id}`}>{nameRuns(a.name)}</Link>
                <span className="card-sub">{a.place}{a.instructor ? <> · <span className="led-by">{t.ledBy(a.instructor)}</span></> : null}</span>
              </div>
              {/* Every time has started: the activity is over, not full. */}
              {a.upcoming.length === 0 ? <span className="badge">{t.activityEnded}</span>
                : a.open.length === 0 ? <span className="badge">{t.fullyBooked}</span> : null}
            </div>
            {a.upcoming.length > 0 ? (
              <div className="stack" style={{ gap: 8 }}>
                {EVENT.days.map((d) => {
                  const times = a.upcoming.filter((s) => dayOf(s.startsAt)?.key === d.key);
                  if (!times.length) return null;
                  return (
                    // One row of chips per day; each chip carries its own date ("11/14（六） 下午 2:50").
                    <div key={d.key} className="chips">
                      {times.map((s) => {
                        // Full times stay in the list, greyed out, so people can see when the activity runs.
                        if (s.remaining === 0) {
                          return (
                            <span key={s.id} className="chip full" aria-label={t.chipFullAria(a.name, fmtDayTimeL(s.startsAt, lang))}>
                              {/* One unbroken line through the date and time. */}
                              <span className="chip-when"><span className="chip-date">{dayText(d, 'short', lang)}</span> <b>{fmtTimeL(s.startsAt, lang)}</b></span>
                              <span>{t.full}</span>
                            </span>
                          );
                        }
                        const low = isLow(s.remaining, s.capacity);
                        return (
                          <Link key={s.id} className={`chip ${low ? 'low' : 'open'}`} href={`/activity/${a.id}?slot=${s.id}`}
                            aria-label={t.chipAria(a.name, fmtDayTimeL(s.startsAt, lang), s.remaining)}>
                            <span className="chip-date">{dayText(d, 'short', lang)}</span>
                            <b>{fmtTimeL(s.startsAt, lang)}</b>
                            <span>{low ? t.onlyLeft(s.remaining) : t.left(s.remaining)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        ))}
        {acts.length === 0 ? <p className="empty">{t.dayFull}</p> : null}
      </main>
      <LegalFoot lang={lang} />
    </div>
  );
}
