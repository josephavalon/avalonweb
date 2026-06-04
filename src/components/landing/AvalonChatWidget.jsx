import React from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Send, X } from 'lucide-react';
import { getAvalonConciergeReply } from '../../content/avalonConciergeKnowledge';

const HIDDEN_PREFIXES = ['/admin', '/provider', '/login'];

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

export default function AvalonChatWidget() {
  const { pathname } = useLocation();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState(() => [
    buildMessage('bot', 'Welcome to Avalon. Ask me about booking, therapies, pricing, service area, memberships, or VITALITY26.'),
  ]);
  const transcriptRef = React.useRef(null);

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

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-3 z-50 md:bottom-6 md:right-6">
      {open && (
        <div className="mb-3 w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.4rem] border border-foreground/14 bg-background/82 text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_28px_110px_rgba(0,0,0,0.34)] backdrop-blur-2xl backdrop-saturate-150">
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
      <div className="flex items-center justify-end gap-2">
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-11 rounded-full border border-foreground/14 bg-background/72 px-4 font-body text-[11px] font-black uppercase tracking-[0.16em] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_16px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl backdrop-saturate-150"
          >
            Have a question?
          </button>
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
    </div>
  );
}
