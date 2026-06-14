import React from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Send, X } from 'lucide-react';
import { getAvalonConciergeReply } from '../../content/avalonConciergeKnowledge';

const HIDDEN_PREFIXES = ['/admin', '/provider', '/login', '/subscription', '/book', '/protocols'];

function hiddenRoute(pathname = '') {
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function buildMessage(role, text) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    text,
  };
}

export default function AvalonChatWidget({ placement = 'floating' }) {
  const { pathname } = useLocation();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState(() => []);
  const transcriptRef = React.useRef(null);
  const inline = placement === 'inline';
  const hero = placement === 'hero';
  const bar = placement === 'bar';

  React.useEffect(() => {
    if (!open || !transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, open]);

  const sendMessage = React.useCallback((value) => {
    const text = String(value || '').trim();
    if (!text) return;

    const reply = getAvalonConciergeReply(text);
    setMessages((current) => [...current, buildMessage('user', text), buildMessage('bot', reply)]);
    setInput('');
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  if (hiddenRoute(pathname)) return null;
  if ((inline || hero || bar) && pathname !== '/') return null;

  const containerClass = bar
    ? 'pointer-events-none absolute right-2 top-1/2 z-[90] flex -translate-y-1/2 flex-col items-end md:hidden'
    : hero
    ? 'pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+4.65rem)] right-5 z-30 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col items-end md:hidden'
    : inline
    ? 'relative z-20 mx-auto my-4 flex w-full max-w-[calc(100vw-2rem)] flex-col items-stretch md:hidden'
    : 'pointer-events-none fixed bottom-6 left-auto right-6 z-50 hidden flex-col items-end md:flex';
  const panelClass = bar
    ? 'av-glass-modal pointer-events-auto absolute bottom-[calc(100%+0.55rem)] right-0 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-[1.4rem] border text-foreground'
    : hero
    ? 'av-glass-modal pointer-events-auto mb-2 w-full overflow-hidden rounded-[1.4rem] border text-foreground'
    : inline
    ? 'av-glass-modal pointer-events-auto mb-3 w-full overflow-hidden rounded-[1.4rem] border text-foreground'
    : 'av-glass-modal pointer-events-auto mb-3 w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.4rem] border text-foreground';
  const promptClass = inline
    ? 'av-glass-widget flex min-h-12 flex-1 items-center justify-center truncate rounded-full border px-4 font-body text-[11px] font-black uppercase leading-none tracking-[0.16em] text-foreground'
    : 'av-glass-widget hidden min-h-11 max-w-[calc(100vw-6.5rem)] items-center justify-center truncate rounded-full border px-4 font-body text-[11px] font-black uppercase leading-none tracking-[0.16em] text-foreground min-[430px]:inline-flex';
  const launcherClass = bar
    ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.24)] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
    : hero
    ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-foreground/18 bg-foreground text-background shadow-[0_16px_45px_rgba(0,0,0,0.26)] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60'
    : inline
    ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-foreground/18 bg-foreground text-background shadow-[0_16px_45px_rgba(0,0,0,0.26)] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60'
    : 'flex h-14 w-14 items-center justify-center rounded-full border border-foreground/18 bg-foreground text-background shadow-[0_22px_70px_rgba(0,0,0,0.34)] transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60 md:h-16 md:w-16';

  return (
    <div className={containerClass}>
      {open && (
        <div className={panelClass}>
          <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-4">
            <div>
              <p className="font-body text-[10px] font-black uppercase tracking-[0.22em] text-foreground/54">Avalon Concierge</p>
              <p className="mt-1 font-body text-sm font-semibold leading-snug text-foreground">Ask anything.</p>
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
          {messages.length > 0 && (
            <div ref={transcriptRef} className="max-h-[18rem] space-y-2 overflow-y-auto px-3 py-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[86%] rounded-[1.1rem] px-3 py-2.5 font-body text-xs font-semibold leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-foreground text-background'
                        : 'border border-foreground/10 bg-foreground/[0.06] text-foreground/78'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-foreground/10 px-3 py-3">
            <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-full border border-foreground/12 bg-foreground/[0.06] p-1">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                type="text"
                autoComplete="off"
                className="min-h-11 flex-1 bg-transparent px-3 font-body text-sm font-semibold text-foreground placeholder:text-foreground/38 focus:outline-none"
                placeholder="Ask Avalon"
                aria-label="Ask Avalon concierge"
              />
              <button
                type="submit"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" strokeWidth={2} />
              </button>
            </form>
          </div>
        </div>
      )}
      <div className="pointer-events-auto flex max-w-full items-center justify-end gap-2">
        {!open && !hero && !bar && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={promptClass}
          >
            Have a question?
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={launcherClass}
          aria-label={open ? 'Close Avalon concierge chat' : 'Open Avalon concierge chat'}
        >
          <MessageCircle className="h-6 w-6" style={{ color: '#050505' }} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
