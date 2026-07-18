// Real @avalon_vitality posts, pulled 2026-07-17 from instagram.com/avalon_vitality/embed/.
// Images are re-hosted at /public/social/ig-*.jpg because IG CDN URLs are
// signed and expire.
//
// To grow the feed: drop new files at /public/social/ig-N.jpg and append
// entries below. The marquee caps at 30 and repeats what it has to fill.
// The feed still tries `/api/instagram-feed` first — if you ever set the
// Meta Graph API env vars, live posts replace these placeholders.
const IG_PROFILE = 'https://instagram.com/avalon_vitality';

export const PLACEHOLDER_POSTS = [
  {
    id: 'ig-1',
    imageUrl: '/social/ig-1.jpg',
    permalink: IG_PROFILE,
    timestamp: 'RECENT',
    caption: 'Feeling drained? Hydration and recovery — Personalized IV therapy, Bay Area, California.',
    likes: 0,
    comments: 0,
  },
  {
    id: 'ig-2',
    imageUrl: '/social/ig-2.jpg',
    permalink: IG_PROFILE,
    timestamp: 'RECENT',
    caption: "Choose your protocol. We'll come to you. Hydration · Energy · Myers' · NAD+ · Recovery · Immunity.",
    likes: 0,
    comments: 0,
  },
  {
    id: 'ig-3',
    imageUrl: '/social/ig-3.jpg',
    permalink: IG_PROFILE,
    timestamp: 'RECENT',
    caption: 'We are here to make it happen for you.',
    likes: 0,
    comments: 0,
  },
  {
    id: 'ig-4',
    imageUrl: '/social/ig-4.jpg',
    permalink: IG_PROFILE,
    timestamp: 'RECENT',
    caption: 'Investing in your people is investing in your performance — concierge IV for teams and events.',
    likes: 0,
    comments: 0,
  },
  {
    id: 'ig-5',
    imageUrl: '/social/ig-5.jpg',
    permalink: IG_PROFILE,
    timestamp: 'RECENT',
    caption: 'Where the city lights meet the ocean — a 4th of July evening on the San Francisco Bay.',
    likes: 0,
    comments: 0,
  },
  {
    id: 'ig-6',
    imageUrl: '/social/ig-6.jpg',
    permalink: IG_PROFILE,
    timestamp: 'RECENT',
    caption: 'Celebrating life. Creating memories. Building community. Welcome to Avalon.',
    likes: 0,
    comments: 0,
  },
];

export const IG_HANDLE_URL = IG_PROFILE;
