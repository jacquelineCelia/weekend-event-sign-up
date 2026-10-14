import { cookies, headers } from 'next/headers';
import { LANG_COOKIE, isLang, langFromAcceptLanguage, type Lang } from './i18n';

/** The language for this request: the visitor's choice if they made one, else their browser's. */
export async function getLang(): Promise<Lang> {
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(chosen)) return chosen;
  return langFromAcceptLanguage((await headers()).get('accept-language'));
}
