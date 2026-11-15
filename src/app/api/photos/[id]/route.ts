import { photoResponse } from '@/lib/photo-response';

export const dynamic = 'force-dynamic';

/** One photo, full size, for the public gallery. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return photoResponse((await params).id, false);
}
