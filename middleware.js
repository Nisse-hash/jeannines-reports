export default function middleware(req) {
  const { pathname } = new URL(req.url);

  if (
    pathname === '/login.html' ||
    pathname === '/api/auth' ||
    pathname.startsWith('/_vercel') ||
    /^\/reports\/chart-.*\.png$/.test(pathname)
  ) return;

  const url = new URL(req.url);
  const validToken = process.env.AUTH_TOKEN || '';
  const linkToken  = process.env.REPORT_LINK_TOKEN || '';

  // Allow access via secret link token in query param
  if (linkToken && url.searchParams.get('t') === linkToken) return;

  const cookieHeader = req.headers.get('cookie') || '';
  const authValue = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('jr_auth='))
    ?.slice('jr_auth='.length);

  if (!authValue || authValue !== validToken) {
    const loginUrl = new URL('/login.html', req.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
    return Response.redirect(loginUrl, 302);
  }
}

export const config = {
  matcher: ['/((?!_vercel).*)'],
};
