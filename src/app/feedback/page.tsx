// The feedback page's Chinese text is set in 思源宋體 (Noto Serif), chosen by the organizers for a calmer
// feel; imported here only, so other pages don't download it.
import '@fontsource/noto-serif-tc/400.css';
import '@fontsource/noto-serif-tc/600.css';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/600.css';
import Link from 'next/link';
import { Back } from '@/components/icons';
import LangToggle from '@/components/LangToggle';
import { getPool } from '@/lib/db';
import { requestTime } from '@/lib/event';
import { eventName } from '@/lib/hans';
import { dict } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { activitiesAllDays } from '@/lib/queries';
import { currentOwners } from '@/lib/viewer';
import FeedbackForm from './FeedbackForm';

export const dynamic = 'force-dynamic';

export default async function Feedback() {
  const lang = await getLang();
  const t = dict(lang);
  const activities = (await activitiesAllDays(lang))
    .filter((a) => a.slots.length > 0)
    .map((a, i) => ({ id: a.id, name: a.name, number: i + 1 }));

  // Signed in as one person: fill in their name and email, and tick the activities they signed up for
  // that have started. (A household on one email isn't prefilled, as on the sign-up form.)
  let prefill = { name: '', email: '', activityIds: [] as string[] };
  const { ids } = await currentOwners();
  if (ids.length === 1) {
    const pool = getPool();
    const p = (await pool.query<{ name: string; email: string | null }>('select name, email from people where id = $1', [ids[0]])).rows[0];
    const joined = await pool.query<{ activity_id: string }>(
      `select distinct s.activity_id from bookings b join slots s on s.id = b.slot_id
        where b.person_id = $1 and b.status = 'confirmed' and s.starts_at <= $2`,
      [ids[0], new Date(requestTime())],
    );
    if (p) prefill = { name: p.name, email: p.email ?? '', activityIds: joined.rows.map((r) => r.activity_id) };
  }

  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href="/"><Back /> {t.allActivities}</Link>
        <LangToggle lang={lang} />
      </div>
      <div className="fb-font">
        <FeedbackForm lang={lang} event={eventName(lang)} activities={activities} prefill={prefill} />
      </div>
    </div>
  );
}
