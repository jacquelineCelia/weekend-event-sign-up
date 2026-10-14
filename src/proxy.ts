import { NextResponse, type NextRequest } from 'next/server';

// Shareable language links: /zh (or /zh/anything) opens the app in Traditional Chinese,
// /en in English. The choice is remembered, then the visitor lands on the normal address.
export function proxy(req: NextRequest) {
  const m = req.nextUrl.pathname.match(/^\/(zh|en)(\/.*)?$/);
  if (!m) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = m[2] || '/';
  const res = NextResponse.redirect(url);
  res.cookies.set('mw_lang', m[1], { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}

export const config = { matcher: ['/zh', '/zh/:path*', '/en', '/en/:path*'] };
