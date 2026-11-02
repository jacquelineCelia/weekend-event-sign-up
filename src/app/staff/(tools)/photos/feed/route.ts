import { NextResponse } from 'next/server';
import { photoFeed } from '@/lib/photos';
import { isStaff } from '@/lib/session';
import { staffLang } from '@/lib/staff-lang';

export const dynamic = 'force-dynamic';

/** The slideshow's list of photos (under /staff because the staff cookie only covers that path). */
export async function GET() {
  if (!(await isStaff())) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  return NextResponse.json({ photos: await photoFeed(await staffLang()) }, { headers: { 'Cache-Control': 'no-store' } });
}
