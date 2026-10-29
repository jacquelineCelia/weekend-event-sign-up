import Link from 'next/link';
import { activitiesWithCounts, scheduleFor, seatTypesFor } from '@/lib/staff';
import { EVENT, addMinutes, dayByKey, dayText, requestTime } from '@/lib/event';
import { localText } from '@/lib/hans';
import { nameRuns } from '@/components/ActivityName';
import { zhBold } from '@/lib/i18n';
import { staffLang } from '@/lib/staff-lang';
import { sdict } from '@/lib/staff-i18n';
import { Plus } from '@/components/icons';
import SlotEditor from './SlotEditor';
import ActivityForm from './ActivityForm';
import SeatingEditor from './SeatingEditor';
import FilterList from '../FilterList';

export const dynamic = 'force-dynamic';

export default async function Schedule({ searchParams }: { searchParams: Promise<{ day?: string; a?: string; saved?: string; past?: string; seated?: string }> }) {
  const sp = await searchParams;
  const lang = await staffLang();
  const t = sdict(lang);
  const day = dayByKey(sp.day);
  const now = requestTime();
  const allActs = await activitiesWithCounts(day.date);
  // An activity is finished for this day once its last time that day has ended.
  // Activities with no times that day stay listed, so times can be added.
  const done = (a: (typeof allActs)[number]) => !!a.last_start && addMinutes(a.last_start, a.duration_min).getTime() <= now;
  const showPast = sp.past === '1';
  const finished = allActs.filter(done).length;
  const acts = showPast ? allActs : allActs.filter((a) => !done(a));
  const isNew = sp.a === 'new';
  const cur = isNew ? null : allActs.find((a) => a.id === sp.a) ?? acts[0] ?? null;
  const slots = cur ? await scheduleFor(cur.id, day.date) : [];
  const seatTypes = cur ? await seatTypesFor(cur.id) : [];
  const seatTotal = seatTypes.length ? seatTypes.reduce((n, s) => n + s.capacity, 0) : null;
  const href = (q: { day?: string; a?: string; past?: boolean }) =>
    `/staff/schedule?day=${q.day ?? day.key}&a=${q.a ?? cur?.id ?? ''}${(q.past ?? showPast) ? '&past=1' : ''}`;

  return (
    <div className="staffbody">
      <aside className="staffside scrollside" aria-label={t.activities} style={{ maxWidth: 360 }}>
        <h2 className="h2" style={{ fontSize: 18, color: 'var(--ink-2)' }}>{t.activities}</h2>
        <FilterList lang={lang} label={t.searchActivities} placeholder={t.searchActivitiesHint} noun="activity" 
          items={acts.map((a) => ({
            key: a.id,
            search: `${a.name} ${a.name_zh} ${a.place} ${a.place_zh} ${a.instructor} ${a.instructor_zh}`,
            node: (
          <Link className="session" href={href({ a: a.id })} aria-current={a.id === cur?.id ? 'true' : undefined} style={{ padding: '13px 18px', borderRadius: 18 }}>
            <span className={`serif${zhBold(localText(a.name, a.name_zh, lang))}`} style={{ fontSize: 16 }}>{nameRuns(localText(a.name, a.name_zh, lang))}</span>
            <span className="meta">
              {t.actMeta(a.slots, a.spots, dayText(day, 'label', lang))}
              {!a.name_zh || !a.place_zh || (a.description && !a.description_zh) || (a.instructor && !a.instructor_zh) ? (
                <span title={t.zhMissingTitle}
                  style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, background: 'var(--ochre-pale)', color: 'var(--ochre-dark)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {lang === 'en' ? <><span lang="zh-Hant-TW">中</span> {t.zhMissing}</> : t.zhMissing}
                </span>
              ) : null}
            </span>
          </Link>
            ),
          }))} />
        {acts.length === 0 && allActs.length > 0 ? <p className="muted" style={{ margin: 4 }}>{t.allActsFinished(dayText(day, 'label', lang))}</p> : null}
        {finished > 0 ? (
          <Link href={href({ a: cur && !done(cur) ? cur.id : '', past: !showPast })} style={{ fontSize: 14, fontWeight: 600, color: 'var(--moss)', padding: '0 4px' }}>
            {showPast ? t.hideFinishedActs : t.showFinishedActs(finished)}
          </Link>
        ) : null}
        <Link className="btn ghost" href={`/staff/schedule?day=${day.key}&a=new`} style={{ border: '1.5px dashed #8c9688', color: 'var(--moss-dark)' }} aria-current={isNew ? 'true' : undefined}>
          <Plus size={18} /> {t.addActivity}
        </Link>
      </aside>

      <main className="staffmain" style={{ gap: 18 }}>
        {isNew ? (
          <>
            <h1 className="h1" style={{ fontSize: 34 }}>{t.newActivity}</h1>
            <ActivityForm activity={null} lang={lang} />
          </>
        ) : cur ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14 }}>
              <div className="stack" style={{ gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--moss)' }}>{t.sessionsLength(localText(cur.place, cur.place_zh, lang), cur.duration_min)}{cur.instructor ? ` · ${t.ledBy(localText(cur.instructor, cur.instructor_zh, lang))}` : ''}</span>
                <h1 className={`h1${zhBold(localText(cur.name, cur.name_zh, lang))}`} style={{ fontSize: 34 }}>{nameRuns(localText(cur.name, cur.name_zh, lang))}</h1>
              </div>
              <nav className="segment" aria-label={t.dayNav} style={{ minWidth: 280 }}>
                {EVENT.days.map((d) => (
                  <Link key={d.key} href={href({ day: d.key })} aria-current={d.key === day.key ? 'true' : undefined}>{dayText(d, 'label', lang)}</Link>
                ))}
              </nav>
            </div>
            <SlotEditor
              key={`${cur.id}-${day.key}-${slots.map((s) => `${s.id}${s.time}${s.capacity}${s.booked}`).join()}`}
              activityId={cur.id}
              day={day.date}
              dayName={dayText(day, 'long', lang)}
              lang={lang}
              durationMin={cur.duration_min}
              initial={slots}
              seatTotal={seatTotal}
              justSaved={sp.saved !== undefined && sp.a === cur.id ? Number(sp.saved) || 0 : null}
            />
            <SeatingEditor
              key={`${cur.id}-${seatTypes.map((s) => `${s.id}${s.name}${s.nameZh}${s.capacity}${s.minCapacity}`).join()}`}
              activityId={cur.id}
              dayKey={day.key}
              initial={seatTypes}
              lang={lang}
              justSaved={sp.seated === '1' && sp.a === cur.id}
            />
            <details className="panel" style={{ gap: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 32 }}>{t.editDetails}</summary>
              <ActivityForm activity={{ id: cur.id, name: cur.name, place: cur.place, durationMin: cur.duration_min, description: cur.description, nameZh: cur.name_zh, placeZh: cur.place_zh, descriptionZh: cur.description_zh, instructor: cur.instructor, instructorZh: cur.instructor_zh }} lang={lang} />
            </details>
          </>
        ) : (
          <p className="muted">{t.noActivities}</p>
        )}
      </main>
    </div>
  );
}
