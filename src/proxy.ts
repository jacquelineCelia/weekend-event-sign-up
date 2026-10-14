import { NextResponse, type NextRequest } from 'next/server';

// Shareable language links. Traditional Chinese: /zh, /tw, /zh-tw. Simplified Chinese: /cn, /zh-cn.
// English: /en. The choice is remembered, then the visitor lands on the normal address.
const LINKS: Record<string, 'en' | 'zh' | 'zhs'> = { en: 'en', zh: 'zh', tw: 'zh', 'zh-tw': 'zh', cn: 'zhs', 'zh-cn': 'zhs' };

export function proxy(req: NextRequest) {
  const m = req.nextUrl.pathname.match(/^\/(zh-tw|zh-cn|zh|tw|cn|en)(\/.*)?$/i);
  if (!m) {
    // Tell the page whether it's a staff screen or an attendee screen (attendee screens turn off
    // browser machine translation, since they have their own Chinese versions).
    const headers = new Headers(req.headers);
    headers.set('x-mw-area', /^\/staff(\/|$)/.test(req.nextUrl.pathname) ? 'staff' : 'attendee');
    return NextResponse.next({ request: { headers } });
  }
  const url = req.nextUrl.clone();
  url.pathname = m[2] || '/';
  const res = NextResponse.redirect(url);
  res.cookies.set('mw_lang', LINKS[m[1].toLowerCase()], { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}

// Every page (not Next's own files, API routes or static files like fonts and images).
export const config = {
  matcher: ['/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)'],
};
