// Live Instagram feed for @avalon_vitality — Meta Graph API proxy.
//
// Env vars (set in Vercel):
//   INSTAGRAM_ACCESS_TOKEN  — long-lived user access token (Instagram Graph API)
//   INSTAGRAM_USER_ID       — Instagram Business/Creator account ID
//
// Response: { posts: [{ id, caption, imageUrl, permalink, timestamp }] }
// Cache: 15 min shared, 5 min stale-while-revalidate.
// Falls back to 200 { posts: [] } if credentials aren't configured so the client
// renders the static placeholder feed rather than an error.

const CACHE_TTL_MS = 15 * 60 * 1000;
let cached = null;
let cachedAt = 0;

function normalize(item) {
  if (!item) return null;
  const isVideo = item.media_type === 'VIDEO';
  const imageUrl = isVideo ? (item.thumbnail_url || item.media_url) : item.media_url;
  if (!imageUrl || !item.permalink) return null;
  return {
    id: item.id,
    caption: String(item.caption || '').slice(0, 240),
    imageUrl,
    permalink: item.permalink,
    timestamp: item.timestamp || null,
  };
}

async function fetchFromMeta(token, userId, limit) {
  const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp';
  const url = `https://graph.instagram.com/v20.0/${encodeURIComponent(userId)}/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`instagram_graph_${res.status}`);
    err.body = body.slice(0, 500);
    throw err;
  }
  const json = await res.json();
  const items = Array.isArray(json.data) ? json.data : [];
  return items.map(normalize).filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!token || !userId) {
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({ posts: [], source: 'placeholder' });
  }

  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    return res.status(200).json({ posts: cached, source: 'cache' });
  }

  try {
    const posts = await fetchFromMeta(token, userId, 10);
    cached = posts;
    cachedAt = now;
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=300');
    return res.status(200).json({ posts, source: 'live' });
  } catch (error) {
    if (cached) {
      res.setHeader('Cache-Control', 's-maxage=60');
      return res.status(200).json({ posts: cached, source: 'stale', error: error.message });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ posts: [], source: 'error', error: error.message });
  }
}
