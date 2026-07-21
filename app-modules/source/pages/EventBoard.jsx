import { useParams } from 'react-router-dom';
import QueueBoard, { useBoard } from '@/components/events/QueueBoard';
import { MONO_STACK } from '@/lib/eventStatus';
import { useSeo } from '@/lib/seo';

/**
 * /events/:slug/board — the standalone departures board (TV / iPad on a
 * stand, blueprint §6.3.2.5). Initials only, opt-out honored server-side.
 * Chrome-free full-black: this page IS signage.
 */
export default function EventBoard() {
  const { slug = '' } = useParams();
  const { board, eventName, stale } = useBoard(slug, { intervalMs: 10000 });

  useSeo({
    title: 'The Lounge — Avalon Vitality',
    description: 'Live recovery lounge queue.',
    path: `/events/${slug}/board`,
    robots: 'noindex,nofollow',
  });

  return (
    <div className="min-h-screen w-full bg-black px-8 py-10 text-foreground md:px-16 md:py-14">
      <QueueBoard
        rows={board}
        large
        title="THE LOUNGE"
        subtitle={`${(eventName || 'AVALON RECOVERY').toUpperCase()} · LIVE QUEUE`}
        stale={stale}
      />
      <p className="fixed bottom-8 left-8 right-8 text-center text-lg text-white/50 md:bottom-12" style={{ fontFamily: MONO_STACK, letterSpacing: '0.14em' }}>
        5-MIN SHOTS · 30-MIN DRIPS — SIGN IN AT THE IPAD, WE'LL PUT YOUR NAME IN LIGHTS
      </p>
    </div>
  );
}
