import { getPool } from './db';
import { requestTime } from './event';

export type RatingAnswer = { column: 'calm'; value: number } | { column: 'again'; value: boolean };

/** Reads one tap from a rating form: "calm" (1–5) or "again" (yes / no). */
export function ratingFromForm(form: FormData): RatingAnswer | null {
  if (form.has('calm')) {
    const n = Number(form.get('calm'));
    return Number.isInteger(n) && n >= 1 && n <= 5 ? { column: 'calm', value: n } : null;
  }
  const again = form.get('again');
  if (again === 'yes' || again === 'no') return { column: 'again', value: again === 'yes' };
  return null;
}

/**
 * Saves one answer for a confirmed sign-up that has started; the other answer is left as it was.
 * `owners`: when given, the sign-up must belong to one of these people (My sign-ups). A signed rating
 * link passes null: the link itself is the permission.
 */
export async function saveRating(bookingId: string, answer: RatingAnswer, owners: string[] | null) {
  const col = answer.column; // 'calm' | 'again', never user text
  await getPool().query(
    `insert into ratings (booking_id, ${col})
     select b.id, $3 from bookings b join slots s on s.id = b.slot_id
      where b.id = $1 and ($2::uuid[] is null or b.person_id = any($2::uuid[]))
        and b.status = 'confirmed' and s.starts_at < $4
     on conflict (booking_id) do update set ${col} = excluded.${col}, updated_at = now()`,
    [bookingId, owners, answer.value, new Date(requestTime())],
  );
}
