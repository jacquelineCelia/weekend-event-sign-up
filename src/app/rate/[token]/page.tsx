import Link from 'next/link';
import type { Metadata } from 'next';
import { Back } from '@/components/icons';
import LangToggle from '@/components/LangToggle';
import { nameRuns } from '@/components/ActivityName';
import { getPool } from '@/lib/db';
import { dayOf, dayText, fmtTimeL, isChinese, requestTime } from '@/lib/event';
import { dict, zhBold } from '@/lib/i18n';
import { getLang } from '@/lib/lang';
import { bookingText, getBooking } from '@/lib/queries';
import { readRateToken } from '@/lib/rate-link';
import RateForm from './RateForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false } };

/** Opened from a "How was it?" email: rate one sign-up without signing in. */
export default async function Rate({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lang = await getLang();
  const t = dict(lang);
  const id = readRateToken(token);
  const b = id ? await getBooking(id) : null;

  const top = (
    <div className="topbar">
      <Link className="back" href="/"><Back /> {t.allActivities}</Link>
      <LangToggle lang={lang} />
    </div>
  );
  if (!b || b.status !== 'confirmed') {
    return (
      <div className="phone">
        {top}
        <main className="pad stack" style={{ gap: 14, paddingTop: 12 }}>
          <h1 className="h1">{t.ratePage.badTitle}</h1>
          <p className="photo-lede">{t.ratePage.badBody}</p>
          <Link className="btn" href="/me">{t.mySignups}</Link>
        </main>
      </div>
    );
  }

  const { activity, place } = bookingText(b, lang);
  const day = dayOf(b.startsAt);
  const when = `${day ? dayText(day, 'short', lang) : ''}${isChinese(lang) ? '' : ' · '}${fmtTimeL(b.startsAt, lang)}`;
  const started = b.startsAt.getTime() <= requestTime();
  const r = (await getPool().query<{ calm: number | null; again: boolean | null }>(
    'select calm, again from ratings where booking_id = $1', [b.id],
  )).rows[0];

  return (
    <div className="phone">
      {top}
      <main className="pad stack" style={{ gap: 20, paddingTop: 12, paddingBottom: 40 }}>
        <div className="stack" style={{ gap: 8 }}>
          <h1 className={`h1${zhBold(activity)}`}>{nameRuns(activity)}</h1>
          <span className="card-sub" style={{ fontSize: 16 }}>{when} · {place}</span>
          {b.personName ? <span className="hint" style={{ fontSize: 15 }}>{t.msg.forPerson(b.personName)}</span> : null}
        </div>
        {started ? (
          <>
            <p className="photo-lede" style={{ margin: 0 }}>{t.ratePage.lede}</p>
            <RateForm token={token} lang={lang} calm={r?.calm ?? null} again={r?.again ?? null} />
          </>
        ) : (
          <p className="photo-lede">{t.ratePage.notStarted}</p>
        )}
      </main>
    </div>
  );
}
