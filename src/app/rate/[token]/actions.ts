'use server';

import { readRateToken } from '@/lib/rate-link';
import { ratingFromForm, saveRating } from '@/lib/ratings';

/** One tap on the rating page opened from a "How was it?" email. The signed link is the permission. */
export async function rateByLinkAction(token: string, form: FormData) {
  const id = readRateToken(token);
  const answer = ratingFromForm(form);
  if (!id || !answer) return { ok: false };
  await saveRating(id, answer, null);
  return { ok: true };
}
