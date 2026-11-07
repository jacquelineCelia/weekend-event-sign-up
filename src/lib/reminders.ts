import { getPool } from './db';
import { getBooking } from './queries';
import { sendRatingRequest, sendReminder } from './notify';

/**
 * Sends every reminder that is due (activity starts within 15 minutes) exactly once.
 * Safe to run every minute, and safe if two runs overlap: each booking is claimed
 * with SKIP LOCKED before anything is sent.
 */
export async function runReminders() {
  const pool = getPool();
  const claimed = await pool.query<{ id: string }>(
    `with due as (
       select b.id
         from bookings b join slots s on s.id = b.slot_id
        where b.status = 'confirmed'
          and b.reminder_sent_at is null
          and (b.remind_sms or b.remind_email)
          and b.checked_in = 0
          and s.starts_at <= now() + interval '15 minutes'
          and s.starts_at > now() - interval '5 minutes'
        for update of b skip locked)
     update bookings set reminder_sent_at = now()
      where id in (select id from due)
     returning id`,
  );

  const results: { id: string; sent: string[]; error?: string }[] = [];
  for (const { id } of claimed.rows) {
    try {
      const b = await getBooking(id);
      results.push({ id, sent: b ? await sendReminder(b) : [] });
    } catch (err) {
      // Release the claim so the next run retries it.
      await pool.query('update bookings set reminder_sent_at = null where id = $1', [id]);
      results.push({ id, sent: [], error: (err as Error).message });
    }
  }

  // Tidy up holds that ran out, so they stop showing as "held".
  await pool.query(`update bookings set status = 'cancelled', cancelled_at = now()
                     where status = 'held' and hold_expires_at < now() - interval '1 hour'`);
  return results;
}

/**
 * "How was it?" emails, each sent once: for confirmed sign-ups that were checked in (at least one
 * person arrived), have an email, and whose activity ended in the last 3 hours. The window keeps a
 * late start of the job (or old test data) from emailing people about long-past activities. Skipped
 * when both rating questions are already answered.
 */
export async function runRatingEmails() {
  const pool = getPool();
  const claimed = await pool.query<{ id: string }>(
    `with due as (
       select b.id
         from bookings b
         join slots s on s.id = b.slot_id
         join activities a on a.id = s.activity_id
         join people p on p.id = b.person_id
         left join ratings r on r.booking_id = b.id
        where b.status = 'confirmed'
          and b.checked_in > 0
          and b.rate_email_sent_at is null
          and p.email is not null
          and s.starts_at + make_interval(mins => a.duration_min) <= now()
          and s.starts_at + make_interval(mins => a.duration_min) > now() - interval '3 hours'
          and not (r.calm is not null and r.again is not null)
        for update of b skip locked)
     update bookings set rate_email_sent_at = now()
      where id in (select id from due)
     returning id`,
  );
  const results: { id: string; sent: string[]; error?: string }[] = [];
  for (const { id } of claimed.rows) {
    try {
      const b = await getBooking(id);
      results.push({ id, sent: b ? await sendRatingRequest(b) : [] });
    } catch (err) {
      await pool.query('update bookings set rate_email_sent_at = null where id = $1', [id]);
      results.push({ id, sent: [], error: (err as Error).message });
    }
  }
  return results;
}
