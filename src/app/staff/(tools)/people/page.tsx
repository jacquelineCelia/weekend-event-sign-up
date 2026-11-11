import { attendees } from '@/lib/staff';
import { addMinutes, dayOf, dayText, fmtTimeL, requestTime } from '@/lib/event';
import { localText } from '@/lib/hans';
import { displayPhone } from '@/lib/contact';
import { staffLang } from '@/lib/staff-lang';
import { sdict, staffHtmlLang } from '@/lib/staff-i18n';
import AutoRefresh from '../AutoRefresh';
import PeopleList, { type PersonView } from './PeopleList';

export const dynamic = 'force-dynamic';

/** Everyone who has signed up, with all their activities; searchable, and downloadable as a CSV. */
export default async function People() {
  const lang = await staffLang();
  const t = sdict(lang);
  const now = requestTime();
  const list = await attendees();
  const people: PersonView[] = list.map((p) => ({
    id: p.personId, name: p.name, email: p.email, phone: displayPhone(p.phone),
    signups: p.signups.map((s) => {
      const d = dayOf(s.startsAt);
      const finished = addMinutes(s.startsAt, s.durationMin).getTime() <= now;
      return {
        id: s.bookingId,
        when: `${d ? dayText(d, 'short', lang) : ''}${lang === 'en' ? ' · ' : ' '}${fmtTimeL(s.startsAt, lang)}`,
        activity: localText(s.activityName, s.activityNameZh, lang),
        // Searchable in every language the staff might type (English, Traditional, Simplified).
        find: [s.activityName, s.activityNameZh, localText(s.activityName, s.activityNameZh, 'zhs')].join(' ').toLowerCase(),
        zh: lang !== 'en' && !!s.activityNameZh,
        place: localText(s.place, s.placeZh, lang),
        party: s.partySize, checkedIn: s.checkedIn, code: s.code, walkIn: s.walkIn,
        seats: s.seats.map((x) => `${localText(x.name, x.nameZh, lang)} × ${x.count}`).join(lang === 'en' ? ', ' : '、'),
        roster: `/staff?${d ? `day=${d.key}&` : ''}slot=${s.slotId}${finished ? '&past=1' : ''}`,
      };
    }),
  }));

  return (
    <div className="staffbody" style={{ display: 'block' }}>
      <AutoRefresh seconds={30} />
      <main className="staffmain" style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 className="h1" style={{ fontSize: 34 }}>{t.people.title}</h1>
          {list.length ? <a className="btn ghost" href="/staff/people/csv" style={{ minHeight: 48, fontSize: 16 }}>{t.people.download}</a> : null}
        </div>
        <PeopleList people={people} lang={lang} htmlLang={staffHtmlLang(lang)} />
      </main>
    </div>
  );
}
