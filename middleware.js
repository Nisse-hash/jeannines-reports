export default function middleware(req) {
  const { pathname } = new URL(req.url);

  if (
    pathname === '/login.html' ||
    pathname === '/api/auth' ||
    pathname.startsWith('/_vercel')
  ) return;

  const cookieHeader = req.headers.get('cookie') || '';
  const authValue = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('jr_auth='))
    ?.slice('jr_auth='.length);

  const validToken = process.env.AUTH_TOKEN || '';

  if (!authValue || authValue !== validToken) {
    const url = new URL('/login.html', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return Response.redirect(url, 302);
  }
}

export const config = {
  matcher: ['/((?!_vercel).*)'],
};
