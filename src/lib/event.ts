// Event-wide settings. Override with environment variables when the details are final.
export const EVENT = {
  name: process.env.NEXT_PUBLIC_EVENT_NAME ?? 'Mindfulness Weekend',
  timeZone: process.env.EVENT_TZ ?? 'America/New_York',
  days: [
    { key: 'sat', date: '2026-11-14', label: 'Saturday 14', long: 'Saturday 14 November', short: 'Sat 14 Nov' },
    { key: 'sun', date: '2026-11-15', label: 'Sunday 15', long: 'Sunday 15 November', short: 'Sun 15 Nov' },
  ],
  dateRange: 'Sat 14 – Sun 15 November',
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
