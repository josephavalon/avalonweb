import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Mail } from 'lucide-react';
import { useSeo } from '@/lib/seo';

const EVENT_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Avalon Vitality//Bay 2 Breakers 2026//EN
BEGIN:VEVENT
UID:b2b-2026-avalon-vitality
DTSTAMP:20260427T120000Z
DTSTART;TZID=America/Los_Angeles:20260517T080000
DTEND;TZID=America/Los_Angeles:20260517T140000
SUMMARY:Bay to Breakers — Avalon Recovery
LOCATION:Finish line · Ocean Beach · San Francisco
DESCRIPTION:Your Avalon Vitality finish-line IV / shot / boots is reserved. We will text you on race morning with the location. Bring your confirmation email.
END:VEVENT
END:VCALENDAR`;

function downloadIcs() {
  const blob = new Blob([EVENT_ICS], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'avalon-bay-to-breakers-2026.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function B2BThankYou() {
  useSeo({
    title: "You're in — Avalon Vitality",
    description: 'Your Bay to Breakers finish-line recovery is reserved. Race-morning text incoming.',
    path: '/b2b/thank-you',
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FFFEE4', color: '#0A0A0A' }}>
      <style>{`
        .ty-display { font-family: 'Bebas Neue', 'Impact', sans-serif; letter-spacing: 0.02em; }
        .ty-pink { color: #ED7AC3; }
        .ty-card { background:#fff; border:2px solid #0A0A0A; border-radius:16px; box-shadow:6px 6px 0 #0A0A0A; }
        .ty-btn-primary { padding:14px 28px; background:#ED7AC3; color:#0A0A0A; font-family:'Bebas Neue','Impact',sans-serif; font-size:16px; letter-spacing:0.15em; text-transform:uppercase; border:2px solid #0A0A0A; border-radius:999px; box-shadow:4px 4px 0 #0A0A0A; transition:transform .2s cubic-bezier(0.16,1,0.3,1), box-shadow .2s cubic-bezier(0.16,1,0.3,1); }
        .ty-btn-primary:hover { transform:translate(-2px,-2px); box-shadow:6px 6px 0 #0A0A0A; }
        .ty-btn-primary:active { transform:translate(2px,2px); box-shadow:2px 2px 0 #0A0A0A; }
        .ty-btn-secondary { padding:14px 28px; background:transparent; color:#0A0A0A; font-family:'Bebas Neue','Impact',sans-serif; font-size:16px; letter-spacing:0.15em; text-transform:uppercase; border:2px solid #0A0A0A; border-radius:999px; transition:background-color .2s cubic-bezier(0.16,1,0.3,1); }
        .ty-btn-secondary:hover { background:#80C7D3; }
      `}</style>

      <main className="flex-1 flex items-center justify-center px-5 py-12 md:py-20">
        <div className="ty-card max-w-2xl w-full p-8 md:p-12 text-center">
          <p className="ty-display ty-pink text-xs md:text-sm tracking-[0.3em] uppercase mb-3">You&rsquo;re in</p>
          <h1 className="ty-display text-5xl md:text-7xl uppercase leading-[0.95] mb-4">See you at the finish line.</h1>
          <p className="text-base md:text-lg leading-relaxed mb-2">Your Avalon recovery slot is reserved for <strong>Sunday, May 17</strong>.</p>
          <p className="text-sm md:text-base leading-relaxed text-black/70 mb-8">Confirmation email is on its way. We&rsquo;ll text the location race morning.</p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-10">
            <button type="button" onClick={downloadIcs} className="ty-btn-primary inline-flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4" /> Add to calendar
            </button>
            <a href="mailto:support@avalonvitality.co" className="ty-btn-secondary inline-flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" /> Email us
            </a>
          </div>

          <div className="border-t-2 border-black pt-6 text-left space-y-1.5 text-sm md:text-base leading-relaxed">
            <p className="ty-display ty-pink text-[10px] md:text-xs tracking-[0.3em] uppercase mb-2">What&rsquo;s next</p>
            <p>1. Save the date and run your race.</p>
            <p>2. Watch your phone race morning for the location.</p>
            <p>3. Cross the line, walk to our station, show your confirmation. Hydrate. Recover.</p>
          </div>

          <Link to="/" className="inline-flex items-center gap-2 mt-8 ty-display text-xs md:text-sm tracking-[0.25em] uppercase hover:ty-pink transition-colors">
            Back to avalonvitality.co <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
