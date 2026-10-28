import { cookies } from 'next/headers';
import { STAFF_LANG_COOKIE, isStaffLang, sdict } from './staff-i18n';
import type { Lang } from './event';

/** The language staff picked for the staff screens (English until they switch). Server only. */
export async function staffLang(): Promise<Lang> {
  const v = (await cookies()).get(STAFF_LANG_COOKIE)?.value;
  return isStaffLang(v) ? v : 'en';
}

export async function staffDict() {
  return sdict(await staffLang());
}
