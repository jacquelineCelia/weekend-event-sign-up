import { NextResponse, type NextRequest } from 'next/server';
import { MAX_PHOTO_BYTES, hashIp, savePhoto } from '@/lib/photos';

export const dynamic = 'force-dynamic';

/** Public: attendees upload a photo from the /photos page. */
export async function POST(req: NextRequest) {
  // Room for the form's other fields on top of the photo.
  if (Number(req.headers.get('content-length') ?? 0) > MAX_PHOTO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'image' }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'image' }, { status: 400 });
  }
  const image = form.get('image');
  if (!(image instanceof File)) return NextResponse.json({ error: 'image' }, { status: 400 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const result = await savePhoto({
    name: String(form.get('name') ?? ''),
    topicId: String(form.get('topic') ?? ''),
    image: Buffer.from(await image.arrayBuffer()),
    ipHash: hashIp(ip),
  });
  if ('error' in result) {
    const status = result.error === 'busy' ? 429 : result.error === 'full' ? 507 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
