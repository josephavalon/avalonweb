import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Phone, Send, X } from 'lucide-react';

const HIDDEN_PREFIXES = ['/admin', '/provider', '/login'];
const PHONE_URL = 'tel:+14159807708';
const TEXT_URL = 'sms:+14159807708';

const FAQ = [
  {
    question: 'How fast can I book?',
    answer: 'Book online in a few minutes. After payment, Avalon reviews intake and a nurse texts with timing.',
  },
  {
    question: 'Where do you come?',
    answer: 'Avalon serves eligible Bay Area homes, hotels, offices, launches, and events.',
  },
  {
    question: 'What do I pay today?',
    answer: 'One-time visits reserve with a booking deposit. Any remaining balance is due when the visit is completed.',
  },
  {
    question: 'Can I use VITALITY26?',
    answer: 'Yes. New customers can enter code VITALITY26 at checkout for 15% off when eligible.',
  },
];

function hiddenRoute(pathname = '') {
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function AvalonChatWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(FAQ[0]);

  if (hiddenRoute(pathname)) return null;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-3 z-50 md:bottom-6 md:right-6">
      {open && (
        <div className="mb-3 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.4rem] border border-foreground/14 bg-background/78 text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_28px_110px_rgba(0,0,0,0.34)] backdrop-blur-2xl backdrop-saturate-150">
          <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-4">
            <div>
              <p className="font-body text-[10px] font-black uppercase tracking-[0.22em] text-foreground/54">Avalon Concierge</p>
              <p className="mt-1 font-body text-sm font-semibold leading-snug text-foreground">Have a question?</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.045] text-foreground/70"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <div className="grid gap-2 px-3 py-3">
            {FAQ.map((item) => (
              <button
                key={item.question}
                type="button"
                onClick={() => setActive(item)}
                className={`rounded-2xl border px-3 py-2.5 text-left font-body text-xs font-bold leading-snug transition-colors ${
                  active.question === item.question
                    ? 'border-foreground/24 bg-foreground/[0.12] text-foreground'
                    : 'border-foreground/10 bg-background/34 text-foreground/64 hover:text-foreground'
                }`}
              >
                {item.question}
              </button>
            ))}
          </div>
          <div className="border-t border-foreground/10 px-4 py-4">
            <p className="font-body text-sm font-semibold leading-relaxed text-foreground/78">{active.answer}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Link to="/book" className="flex min-h-11 items-center justify-center rounded-full bg-foreground px-3 font-body text-[10px] font-black uppercase tracking-[0.16em] text-background">
                Book
              </Link>
              <a href={TEXT_URL} className="flex min-h-11 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.055] text-foreground" aria-label="Text Avalon">
                <Send className="h-4 w-4" strokeWidth={2} />
              </a>
              <a href={PHONE_URL} className="flex min-h-11 items-center justify-center rounded-full border border-foreground/14 bg-foreground/[0.055] text-foreground" aria-label="Call Avalon">
                <Phone className="h-4 w-4" strokeWidth={2} />
              </a>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-foreground/18 bg-foreground text-background shadow-[0_22px_70px_rgba(0,0,0,0.34)] transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 md:h-16 md:w-16"
        aria-label={open ? 'Close Avalon concierge chat' : 'Open Avalon concierge chat'}
      >
        <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
      </button>
    </div>
  );
}
