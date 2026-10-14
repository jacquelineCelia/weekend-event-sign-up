import { NextResponse, type NextRequest } from 'next/server';

// Shareable language links. Traditional Chinese: /zh, /tw, /zh-tw. Simplified Chinese: /cn, /zh-cn.
// English: /en. The choice is remembered, then the visitor lands on the normal address.
const LINKS: Record<string, 'en' | 'zh' | 'zhs'> = { en: 'en', zh: 'zh', tw: 'zh', 'zh-tw': 'zh', cn: 'zhs', 'zh-cn': 'zhs' };

export function proxy(req: NextRequest) {
  const m = req.nextUrl.pathname.match(/^\/(zh-tw|zh-cn|zh|tw|cn|en)(\/.*)?$/i);
  if (!m) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = m[2] || '/';
  const res = NextResponse.redirect(url);
  res.cookies.set('mw_lang', LINKS[m[1].toLowerCase()], { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}

export const config = {
  matcher: ['/en', '/en/:path*', '/zh', '/zh/:path*', '/tw', '/tw/:path*', '/zh-tw', '/zh-tw/:path*', '/cn', '/cn/:path*', '/zh-cn', '/zh-cn/:path*'],
};
