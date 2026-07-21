import { useEffect, useState } from 'react';
import { EVENT_TONES, MONO_STACK } from '@/lib/eventStatus';

/**
 * The departures board (DESIGN.md signature move #5): initials only, mono
 * voice, split-flap row entrance, live green reserved for NOW rows. Shared by
 * the kiosk idle state and the standalone /board TV mirror.
 *
 * Poll-only by design (eng review 5A): the stream is a hint, the table is
 * truth — a TV that missed a websocket frame must still be right.
 */

const STATUS_ROW = {
  in_gfe: (r) => ({ who: `NOW — ${r.initials}`, what: r.station ? `GFE · ${String(r.station).toUpperCase()}` : 'GFE STATION', live: true }),
  at_station: (r) => ({ who: `NOW — ${r.initials}`, what: r.station ? String(r.station).toUpperCase() : 'AT STATION', live: true }),
  called: (r) => ({ who: `UP NEXT — ${r.initials}`, what: r.station ? `MEET US · ${String(r.station).toUpperCase()}` : 'CALLED', live: true }),
  notified: (r) => ({ who: `UP NEXT — ${r.initials}`, what: 'CALLED', live: true }),
  waiting: (r) => ({ who: `№${r.position} — ${r.initials}`, what: r.lane === 'express' ? 'SHOT BAR' : '', live: false }),
};

export function useBoard(slug, { intervalMs = 12000 } = {}) {
  const [data, setData] = useState({ board: [], walkUpGfe: false, eventName: '' });
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`/api/events/kiosk?slug=${encodeURIComponent(slug)}`);
        const body = await res.json();
        if (alive && body.ok) {
          setData({ board: body.board || [], walkUpGfe: body.walkUpGfe, eventName: body.event?.name || '' });
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);   // keep showing the last board; mark freshness
      }
    }
    poll();
    const t = setInterval(poll, intervalMs);
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [slug, intervalMs]);

  return { ...data, stale };
}

export default function QueueBoard({ rows, title = 'THE LOUNGE', subtitle, stale = false, large = false }) {
  const shaped = rows
    .map((r) => (STATUS_ROW[r.status] || STATUS_ROW.waiting)(r))
    .slice(0, large ? 12 : 8);

  return (
    <div className="w-full">
      <p className={`font-heading uppercase leading-none text-foreground ${large ? 'text-7xl' : 'text-4xl'}`}>{title}</p>
      <p className="mt-2 text-[11px] uppercase text-foreground/50" style={{ fontFamily: MONO_STACK, letterSpacing: '0.18em' }}>
        {subtitle || 'AVALON RECOVERY · LIVE QUEUE'}{stale ? ' · RECONNECTING…' : ''}
      </p>
      <div className="mt-5">
        {shaped.length === 0 ? (
          <p className={`border-t border-white/12 py-5 text-foreground/55 ${large ? 'text-2xl' : 'text-sm'}`} style={{ fontFamily: MONO_STACK }}>
            NO WAIT — WALK RIGHT UP
          </p>
        ) : shaped.map((row, i) => (
          <div
            key={`${row.who}-${i}`}
            className={`flex items-center justify-between gap-4 border-t border-white/12 ${large ? 'py-5' : 'py-3'}`}
            style={{
              fontFamily: MONO_STACK,
              color: row.live ? EVENT_TONES.live : EVENT_TONES.ink,
              animation: 'av-flipin 0.5s cubic-bezier(0.22,1,0.36,1) both',
              animationDelay: `${i * 0.06}s`,
            }}
          >
            <span className={large ? 'text-3xl' : 'text-sm'} style={{ letterSpacing: '0.06em' }}>{row.who}</span>
            <span className={large ? 'text-xl' : 'text-xs'} style={{ color: row.live ? EVENT_TONES.live : EVENT_TONES.muted }}>
              {row.what}
            </span>
          </div>
        ))}
      </div>
      <style>{'@keyframes av-flipin{0%{transform:rotateX(90deg);opacity:0}100%{transform:rotateX(0);opacity:1}}@media (prefers-reduced-motion: reduce){[style*="av-flipin"]{animation:none !important;opacity:1 !important;transform:none !important}}'}</style>
    </div>
  );
}
