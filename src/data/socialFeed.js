// Manually curated repost feed.
// Replace placeholder URLs with real post URLs as channels go live.
// To wire live APIs later, swap this file for a fetch from:
//   - Instagram Basic Display API (instagram_business_account)
//   - YouTube Data API v3 (search.list)
//   - TikTok Display API (oembed)
//   - X API v2 (recent tweets)
//
// For now: static thumbnails + captions + outbound links per channel.

export const SOCIAL_FEED = {
  instagram: [
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'NAD+ infusion at a founder’s offsite. 20-hour days, no crash.', url: 'https://instagram.com/avalonvitality' },
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'Beauty IV is a weekly. Glutathione drip, every time.', url: 'https://instagram.com/avalonvitality' },
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'Bay 2 Breakers expo — May 15–18. IM shots and recovery on-site.', url: 'https://instagram.com/avalonvitality' },
  ],
  facebook: [
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'Avalon’s nurses are now serving the entire SF Bay Area.', url: 'https://facebook.com/avalonvitality' },
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'Founding 100 cohort — limited spots. Apply today.', url: 'https://facebook.com/avalonvitality' },
  ],
  youtube: [
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'How an Avalon protocol works — 60 seconds.', url: 'https://youtube.com/@avalonvitality' },
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'Inside the recovery pod — launch event recap.', url: 'https://youtube.com/@avalonvitality' },
  ],
  tiktok: [
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'POV: Avalon nurse arrives. NAD+ in 30 minutes.', url: 'https://tiktok.com/@avalonvitality' },
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'Diplo on the green-room recovery setup.', url: 'https://tiktok.com/@avalonvitality' },
  ],
  x: [
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: '“I code 20hrs a day now. NAD+ makes it happen.” — J.G.', url: 'https://x.com/avalonvitality' },
  ],
  threads: [
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'Quietly building the operating system for human performance.', url: 'https://threads.net/@avalonvitality' },
  ],
  linkedin: [
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'Avalon raises pre-seed, names founding clinical advisor.', url: 'https://linkedin.com/company/avalonvitality' },
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'Now hiring: RNs and Nurse Practitioners across the Bay.', url: 'https://linkedin.com/company/avalonvitality' },
  ],
  reddit: [
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: 'r/sanfrancisco — founder reviews on mobile NAD+.', url: 'https://reddit.com/user/avalonvitality' },
  ],
  google: [
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: '5★ — Avalon team showed up on time and on the dot. Strongly recommend.', url: 'https://g.page/avalonvitality' },
  ],
  yelp: [
    { thumb: '/backgrounds/iv-vitamins-hero.webp', caption: '5★ — Concierge experience start to finish. Game-changer for race weekends.', url: 'https://yelp.com/biz/avalonvitality-san-francisco' },
  ],
};
