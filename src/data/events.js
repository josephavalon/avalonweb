// Shared source of truth for News & Events cards and their detail pages.
// Each event has a slug that routes to /events/:slug.

export const events = [

  {
    slug: 'bay-to-breakers-expo',
    date: 'May 17, 2026',
    title: 'Bay 2 Breakers Expo',
    location: 'Sports Basement, San Francisco',
    desc: 'IM injections and exclusive merchandise sales. Pre-race hydration and IV therapy on-site.',
    briefing: 'Avalon at the Bay to Breakers pre-race expo: IM injections, pre-race hydration protocols, and limited merch. Stop by before race day to dial in your plan.',
    hostName: 'Avalon Vitality',
    hostRole: 'Host',
    when: 'Coming Soon',
    venue: 'Sports Basement, San Francisco',
    capacity: 'Walk-up',
    cover: '/backgrounds/iv-vitamins-hero.webp',
  },
  {
    slug: 'bay-to-breakers-finish-line',
    date: 'May 17, 2026',
    title: 'Bay 2 Breakers Finish Line',
    location: 'Near Finish Line, San Francisco',
    desc: 'Exclusive IVs heavily discounted for race participants. Recovery and hydration right at the finish line.',
    briefing: 'Post-race recovery station near the Bay to Breakers finish line. Discounted recovery drips for registered participants. Walk up or book ahead.',
    hostName: 'Avalon Vitality',
    hostRole: 'Host',
    when: 'Coming Soon',
    venue: 'Near Finish Line, San Francisco',
    capacity: 'Registered runners',
    cover: '/backgrounds/iv-vitamins-hero.webp',
  },

];

export function findEventBySlug(slug) {
  return events.find((e) => e.slug === slug);
}
