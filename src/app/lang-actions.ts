'use server';

import { cookies } from 'next/headers';
import { getPool } from '@/lib/db';
import { LANG_COOKIE, isLang } from '@/lib/i18n';
import { currentOwners } from '@/lib/viewer';

/** EN | 繁中 toggle: remember the choice, and if signed in, send future messages in it too. */
export async function setLangAction(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  const { ids } = await currentOwners();
  if (ids.length) await getPool().query('update people set lang = $2 where id = any($1::uuid[])', [ids, lang]);
}
