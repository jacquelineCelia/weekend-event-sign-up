import * as OpenCC from 'opencc-js/t2cn';
import { EVENT, eventNameL, type Lang } from './event';

// Staff write Chinese once, in Traditional (Taiwan). Simplified (mainland) readers get it converted
// character by character. (OpenCC's phrase mode also swaps Taiwan words for mainland ones, but it
// treats 行程 "plans" as the computing term and makes it 进程 "process", so it isn't safe for free text.)
// Server only: the conversion tables stay out of the page bundle.
const convert = OpenCC.Converter({ from: 'tw', to: 'cn' });
const cache = new Map<string, string>();

export function toSimplified(s: string) {
  if (!s) return s;
  let out = cache.get(s);
  if (out === undefined) {
    out = convert(s);
    if (cache.size > 5000) cache.clear();
    cache.set(s, out);
  }
  return out;
}

/** Activity text for a language: Chinese when staff filled it in (converted for Simplified), else English. */
export function localText(en: string, zhTraditional: string, lang: 'en' | 'zh' | 'zhs') {
  if (lang === 'en' || !zhTraditional) return en;
  return lang === 'zhs' ? toSimplified(zhTraditional) : zhTraditional;
}

/**
 * Who texts come from, with the full organizational chain so carriers can verify the sender:
 * "Mindfulness Weekend (run by Yellow Flower Meditation Academy, part of The Oneness Truth Foundation)".
 * The organizations keep their registered (English) names in every language.
 */
export function smsSender(lang: Lang) {
  const event = eventName(lang);
  if (lang === 'zh') return `${event}（由 ${EVENT.org} 主辦，隸屬 ${EVENT.parentOrg}）`;
  if (lang === 'zhs') return `${event}（由 ${EVENT.org} 主办，隶属于 ${EVENT.parentOrg}）`;
  return `${event} (run by ${EVENT.org}, part of ${EVENT.parentOrg})`;
}

/**
 * The event's name in the reader's language. Simplified uses NEXT_PUBLIC_EVENT_NAME_ZHS when it is set;
 * otherwise it is converted from the Traditional name (NEXT_PUBLIC_EVENT_NAME_ZH), so changing that one
 * changes both.
 */
export function eventName(lang: Lang) {
  if (lang === 'zhs') return process.env.NEXT_PUBLIC_EVENT_NAME_ZHS || toSimplified(EVENT.nameZh);
  return eventNameL(lang);
}

/** "High chair × 1 · Ground seat × 2" (Chinese: "椅子座位 × 1、席地座位 × 2"); empty without seating. */
export function seatLine(seats: { name: string; nameZh: string; count: number }[], lang: Lang) {
  return seats.map((x) => `${localText(x.name, x.nameZh, lang)}\u00a0×\u00a0${x.count}`).join(lang === 'en' ? ' · ' : '、');
}
