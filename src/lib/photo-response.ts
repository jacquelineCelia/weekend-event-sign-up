import sharp from 'sharp';
import { photoImage } from './photos';

/**
 * Public photo responses for the gallery. Browsers and Vercel's CDN may keep a photo for an hour,
 * so a photo staff remove can still load from a saved address for up to an hour (it leaves the
 * gallery at once).
 */
const CACHE = 'public, max-age=3600, s-maxage=3600';

/** The full photo (about 1600 px), or a 600 px thumbnail for the grid. */
export async function photoResponse(id: string, thumb: boolean) {
  const image = await photoImage(id);
  if (!image) return new Response(null, { status: 404 });
  const body = thumb ? await sharp(image).rotate().resize(600, 600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer() : image;
  return new Response(new Uint8Array(body), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': CACHE, 'X-Content-Type-Options': 'nosniff' },
  });
}
