import { timingSafeEqual } from 'node:crypto';
import { runRatingEmails, runReminders } from '@/lib/reminders';

export const dynamic = 'force-dynamic';

// Called once a minute by a scheduler (Supabase pg_cron, or Vercel Cron) with
// "Authorization: Bearer <CRON_SECRET>".
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response('Unauthorized', { status: 401 });
  }
  const results = await runReminders();
  // "How was it?" emails ride on the same once-a-minute job.
  const ratings = await runRatingEmails();
  return Response.json({
    sent: results.filter((r) => !r.error).length, failed: results.filter((r) => r.error).length, results,
    ratingEmails: { sent: ratings.filter((r) => !r.error).length, failed: ratings.filter((r) => r.error).length },
  });
}

export const GET = handle;
export const POST = handle;
