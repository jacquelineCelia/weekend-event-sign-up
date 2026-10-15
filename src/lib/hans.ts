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
 * The event's name in the reader's language. Simplified uses NEXT_PUBLIC_EVENT_NAME_ZHS when it is set;
 * otherwise it is converted from the Traditional name (NEXT_PUBLIC_EVENT_NAME_ZH), so changing that one
 * changes both.
 */
export function eventName(lang: Lang) {
  if (lang === 'zhs') return process.env.NEXT_PUBLIC_EVENT_NAME_ZHS || toSimplified(EVENT.nameZh);
  return eventNameL(lang);
}
