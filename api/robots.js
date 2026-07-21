const PUBLIC_ROBOTS = `# Avalon Vitality robots policy
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin
Disallow: /admin/
Disallow: /provider
Disallow: /provider/
Disallow: /members
Disallow: /members/

Sitemap: https://www.avalonvitality.co/sitemap.xml
`;

const PRIVATE_BETA_ROBOTS = `# Avalon Vitality private beta robots policy
User-agent: *
Disallow: /
`;

function isPrivateBetaHost(host = '') {
  const bare = host.toLowerCase().split(':')[0];
  return bare === 'snooches.avalonvitality.co'
    || bare === 'beta.avalonvitality.co'
    || bare === 'care.avalonvitality.co';
}

export default function handler(req, res) {
  const host = req.headers.host || '';
  const privateBeta = isPrivateBetaHost(host);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  if (privateBeta) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.status(200).send(privateBeta ? PRIVATE_BETA_ROBOTS : PUBLIC_ROBOTS);
}
