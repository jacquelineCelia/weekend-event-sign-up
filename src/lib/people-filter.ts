/**
 * Staff Attendees tab: which people (and which of their sign-ups) match the search box and the
 * "number of activities" filter. Shared by the list in the browser and the CSV download, so the file
 * always holds exactly what's on screen.
 */
export type Matchable = { name: string; email: string; phone: string; signups: { code: string; find: string }[] };

/** The text an activity can be found by: its English, Traditional and Simplified names, lowercased. */
export const activityFind = (names: string[]) => names.filter(Boolean).join(' ').toLowerCase();

/**
 * The sign-ups of `p` to show for this search, or null when the person doesn't match.
 * A match on the person (name, email, phone digits, a code) keeps all their sign-ups; a match on an
 * activity name keeps only the sign-ups for that activity. `count` filters by how many activities
 * the person signed up for in total.
 */
export function matchSignups<P extends Matchable>(p: P, q: string, count: number | null): P['signups'] | null {
  if (count !== null && p.signups.length !== count) return null;
  const ql = q.trim().toLowerCase();
  if (!ql) return p.signups;
  const digits = ql.replace(/\D/g, '');
  const person = p.name.toLowerCase().includes(ql) || p.email.toLowerCase().includes(ql)
    || (digits.length >= 3 && p.phone.replace(/\D/g, '').includes(digits))
    || p.signups.some((s) => s.code.toLowerCase() === ql);
  if (person) return p.signups;
  const hits = p.signups.filter((s) => s.find.includes(ql));
  return hits.length ? hits : null;
}

/** Whether a sign-up matched the search by its activity name (outlined on screen). */
export const activityHit = (s: { find: string }, q: string) => {
  const ql = q.trim().toLowerCase();
  return ql.length > 0 && s.find.includes(ql);
};
