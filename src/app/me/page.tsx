import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getPool } from '@/lib/db';
import { getPerson } from '@/lib/queries';
import { cancelBooking } from '@/lib/booking';
import { currentPersonId } from '@/lib/session';
import { EVENT, dayOf, fmtTime } from '@/lib/event';
import { Back, Leaf } from '@/components/icons';

export const dynamic = 'force-dynamic';

async function cancelAction(form: FormData) {
  'use server';
  const me = await currentPersonId();
  const id = String(form.get('bookingId') ?? '');
  if (me && /^[0-9a-f-]{36}$/i.test(id)) await cancelBooking(id, me).catch(() => {});
  revalidatePath('/me');
}

type Row = { id: string; code: string; party_size: number; starts_at: Date; activity_name: string; place: string; activity_id: string; slot_id: string };

export default async function MySignups() {
  const me = await currentPersonId();
  const person = me ? await getPerson(me) : null;

  if (!person) {
    return (
      <div className="phone">
        <div className="topbar"><Link className="back" href="/"><Back /> Activities</Link></div>
        <section className="pad stack" style={{ gap: 18, paddingTop: 20 }}>
          <span className="leafmark" style={{ width: 52, height: 52 }}><Leaf size={26} /></span>
          <h1 className="h1" style={{ fontSize: 31 }}>Welcome back</h1>
          <p className="lede">
            Sign-ups made on this device show up here. Signing in from another phone with a texted code is coming soon. Until then,
            your confirmation email has your check-in code.
          </p>
          <Link className="btn" href="/">Browse activities</Link>
        </section>
      </div>
    );
  }

  const { rows } = await getPool().query<Row>(
    `select b.id, b.code, b.party_size, s.starts_at, a.name as activity_name, a.place, a.id as activity_id, s.id as slot_id
       from bookings b join slots s on s.id = b.slot_id join activities a on a.id = s.activity_id
      where b.person_id = $1 and b.status = 'confirmed'
      order by s.starts_at`,
    [person.id],
  );
  const now = Date.now();
  const byDay = EVENT.days.map((d) => ({ d, items: rows.filter((r) => dayOf(r.starts_at)?.key === d.key) })).filter((g) => g.items.length);

  return (
    <div className="phone">
      <div className="topbar">
        <Link className="back" href="/"><Back /> Activities</Link>
        <span className="muted" style={{ fontSize: 13, paddingRight: 10 }}>{person.name}</span>
      </div>
      <section className="pad stack" style={{ gap: 6, padding: '8px 20px 18px' }}>
        <h1 className="h1" style={{ fontSize: 31 }}>Your weekend</h1>
        <p className="muted" style={{ margin: 0 }}>{rows.length} {rows.length === 1 ? 'activity' : 'activities'}</p>
      </section>

      {byDay.map(({ d, items }) => (
        <section key={d.key} className="pad stack" style={{ gap: 10, paddingBottom: 20 }}>
          <h2 className="h2" style={{ fontSize: 18, color: 'var(--ink-2)' }}>{d.long}</h2>
          {items.map((r) => {
            const past = r.starts_at.getTime() < now;
            return (
              <article key={r.id} className="card" style={{ borderRadius: 20, padding: 16, gap: 12, background: past ? 'var(--stone)' : undefined }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ width: 74, flex: 'none', fontWeight: 700, color: 'var(--moss)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(r.starts_at)}</div>
                  <div className="stack" style={{ gap: 3 }}>
                    <span className="serif" style={{ fontSize: 17 }}>{r.activity_name}</span>
                    <span className="muted" style={{ fontSize: 13.5 }}>{r.place} · {r.party_size} {r.party_size === 1 ? 'spot' : 'spots'} · code {r.code}</span>
                  </div>
                </div>
                {!past ? (
                  <form action={cancelAction} style={{ paddingLeft: 88 }}>
                    <input type="hidden" name="bookingId" value={r.id} />
                    <button type="submit" className="btn ghost" style={{ minHeight: 42, fontSize: 14, color: 'var(--ochre)' }}>Cancel</button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </section>
      ))}

      <div className="pad" style={{ paddingBottom: 30 }}>
        <Link className="btn ghost" href="/" style={{ width: '100%', border: '1.5px dashed #8c9688' }}>+ Add another activity</Link>
      </div>
    </div>
  );
}
