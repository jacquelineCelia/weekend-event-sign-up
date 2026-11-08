import { getPool } from './db';
import { getBooking } from './queries';
import { sendReminder } from './notify';

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
