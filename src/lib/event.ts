// Event-wide settings. Override with environment variables when the details are final.
export const EVENT = {
  name: process.env.NEXT_PUBLIC_EVENT_NAME ?? 'Mindfulness Weekend',
  nameZh: process.env.NEXT_PUBLIC_EVENT_NAME_ZH ?? '正念週末',
  timeZone: process.env.EVENT_TZ ?? 'America/New_York',
  days: [
    { key: 'sat', date: '2026-11-14', label: 'Saturday 14', long: 'Saturday 14 November', short: 'Sat 14 Nov',
      zh: { label: '11/14（六）', long: '11月14日（星期六）', short: '11/14（六）' } },
    { key: 'sun', date: '2026-11-15', label: 'Sunday 15', long: 'Sunday 15 November', short: 'Sun 15 Nov',
      zh: { label: '11/15（日）', long: '11月15日（星期日）', short: '11/15（日）' } },
  ],
  dateRange: 'Nov 14–15',
  dateRangeZh: '11月14–15日',
} as const;

export type DayKey = (typeof EVENT.days)[number]['key'];

export function dayByKey(key: string | undefined) {
  return EVENT.days.find((d) => d.key === key) ?? EVENT.days[0];
}

const parts = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: EVENT.timeZone, ...opts }).format(d);

/** "11:30 AM" */
export const fmtTime = (d: Date) => parts(d, { hour: 'numeric', minute: '2-digit' });
/** "11:30" (no AM/PM, for compact chips) */
export const fmtTimeShort = (d: Date) => fmtTime(d).replace(/\s?[AP]M$/, '');
/** "2026-11-14" in the event's time zone */
export const localDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: EVENT.timeZone }).format(d);

export function dayOf(d: Date) {
  const date = localDate(d);
  return EVENT.days.find((x) => x.date === date) ?? null;
}

export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

export function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  if (min % 60 === 0) return `${min / 60} hr`;
  return `${Math.floor(min / 60)} hr ${min % 60} min`;
}

/** Few enough left to warn about: 2 or fewer, or a quarter of capacity. */
export const isLow = (remaining: number, capacity: number) => remaining > 0 && remaining <= Math.max(2, Math.ceil(capacity * 0.25));

/** Current time, read once per request on the server. */
export const requestTime = () => Date.now();

// ---------- Language-aware formatting (attendee screens and messages) ----------
export type Lang = 'en' | 'zh';
type Day = (typeof EVENT.days)[number];

/** A day's label in the given language: label "Saturday 14" / "11/14（六）", long, or short. */
export const dayText = (d: Day, kind: 'label' | 'long' | 'short', lang: Lang) => (lang === 'zh' ? d.zh[kind] : d[kind]);

/** "11:30 AM" in English; "上午 11:30" (Taiwan style) in Chinese. */
export function fmtTimeL(d: Date, lang: Lang) {
  if (lang === 'en') return fmtTime(d);
  const p = new Intl.DateTimeFormat('en-US', { timeZone: EVENT.timeZone, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const h = Number(p.find((x) => x.type === 'hour')!.value) % 24;
  const m = p.find((x) => x.type === 'minute')!.value;
  const period = h < 12 ? '上午' : h === 12 ? '中午' : h < 18 ? '下午' : '晚上';
  return `${period} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
}

export function fmtDurationL(min: number, lang: Lang) {
  if (lang === 'en') return fmtDuration(min);
  if (min < 60) return `${min} 分鐘`;
  if (min % 60 === 0) return `${min / 60} 小時`;
  return `${Math.floor(min / 60)} 小時 ${min % 60} 分鐘`;
}
