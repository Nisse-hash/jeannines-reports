export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed');
    return;
  }

  const body = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  const params = new URLSearchParams(body);

  if (params.get('action') === 'logout') {
    res.setHeader('Set-Cookie', 'jr_auth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
    res.writeHead(302, { Location: '/login.html' });
    res.end();
    return;
  }

  const posted = params.get('password') || '';
  const valid  = process.env.SITE_PASSWORD || '';
  const token  = process.env.AUTH_TOKEN    || '';

  if (posted && posted === valid) {
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    res.setHeader('Set-Cookie', `jr_auth=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`);
    const next = params.get('next') || '/dashboard.html';
    res.writeHead(302, { Location: next });
    res.end();
    return;
  }

  res.writeHead(302, { Location: '/login.html?error=1' });
  res.end();
}
