import { photoResponse } from '@/lib/photo-response';

export const dynamic = 'force-dynamic';

/** One photo, 600 px, for the gallery grid. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return photoResponse((await params).id, true);
}
