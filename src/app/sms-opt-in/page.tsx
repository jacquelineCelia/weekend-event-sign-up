import { getPool } from '@/lib/db';
import { addMinutes, dayOf, dayText, fmtTimeL } from '@/lib/event';
import { eventName, localText, smsSender } from '@/lib/hans';
import { dict } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import SignUpSample from './SignUpSample';

// Public page linked from the text-message (A2P 10DLC) campaign as the opt-in example: the sign-up
// details page with an activity already picked, then the success page. Nothing is saved.
export const dynamic = 'force-dynamic';

type Pick = { name: string; place: string; nameZh: string; placeZh: string; durationMin: number; startsAt: Date };

// Used when the schedule has no Sunrise Yoga (e.g. once the real activities are entered).
const FALLBACK: Pick = {
  name: 'Sunrise Yoga', place: 'The Meadow', nameZh: '晨光瑜伽', placeZh: '草原區', durationMin: 45,
  startsAt: new Date('2026-11-14T12:30:00Z'), // 7:30 AM in New York
};

async function pickActivity(): Promise<Pick> {
  try {
    const r = await getPool().query<{ name: string; place: string; name_zh: string; place_zh: string; duration_min: number; starts_at: Date }>(
      `select a.name, a.place, a.name_zh, a.place_zh, a.duration_min, s.starts_at
         from activities a join slots s on s.activity_id = a.id
        where a.name = 'Sunrise Yoga' order by s.starts_at limit 1`,
    );
    const x = r.rows[0];
    if (!x) return FALLBACK;
    return { name: x.name, place: x.place, nameZh: x.name_zh, placeZh: x.place_zh, durationMin: x.duration_min, startsAt: x.starts_at };
  } catch {
    return FALLBACK;
  }
}

export default async function SmsOptIn() {
  const lang = await getLang();
  const t = dict(lang);
  const a = await pickActivity();
  const activity = localText(a.name, a.nameZh, lang);
  const place = localText(a.place, a.placeZh, lang);
  const day = dayOf(a.startsAt);
  const start = fmtTimeL(a.startsAt, lang);
  const end = addMinutes(a.startsAt, a.durationMin);

  return (
    <SignUpSample
      lang={lang}
      smsFrom={smsSender()}
      eventName={eventName(lang)}
      summary={{
        activity,
        when: `${day ? dayText(day, 'short', lang) : ''} · ${start} · ${place}`,
        spots: t.spots(1),
        partySize: 1,
      }}
      ticket={{
        day: day ? dayText(day, 'long', lang) : '',
        time: `${start} – ${fmtTimeL(end, lang)} · ${place}`,
        remindAt: fmtTimeL(addMinutes(a.startsAt, -15), lang),
      }}
      calendar={{ title: `${activity} · ${eventName(lang)}`, place, start: a.startsAt.toISOString(), end: end.toISOString() }}
    />
  );
}
