import { photoImage } from '@/lib/photos';
import { isStaff } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** One photo. A photo's bytes never change, so the show's browser can keep it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isStaff())) return new Response(null, { status: 401 });
  const image = await photoImage((await params).id);
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=604800, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
