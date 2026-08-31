import React from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import AvalonMark from '@/components/AvalonMark';
import {
  Popover,
  PopoverAnchor,
  PopoverArrow,
  PopoverContent,
} from '@/components/ui/popover';
import {
  AVALON_CONCIERGE_PROMPTS,
  getAvalonConciergeReply,
} from '@/content/avalonConciergeKnowledge';
import { isPublicChromeRoute } from '@/lib/publicChrome';

const GREETING_DISMISSED_KEY = 'av.concierge.greetingDismissed';
const GREETING_DELAY_MS = 1500;

function buildMessage(role, text) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    text,
  };
}

function wasGreetingDismissed() {
  try {
    return window.sessionStorage.getItem(GREETING_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistGreetingDismissal() {
  try {
    window.sessionStorage.setItem(GREETING_DISMISSED_KEY, '1');
  } catch {
    // Safari may make storage unavailable. The in-memory state still prevents
    // the card from reopening during the current page lifecycle.
  }
}

export default function AvalonChatWidget() {
  const { pathname } = useLocation();
  const hidden = !isPublicChromeRoute(pathname);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [greetingOpen, setGreetingOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState([]);
  const transcriptRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const dismissGreeting = React.useCallback(() => {
    setGreetingOpen(false);
    persistGreetingDismissal();
  }, []);

  React.useEffect(() => {
    if (hidden || wasGreetingDismissed()) return undefined;
    const timer = window.setTimeout(() => setGreetingOpen(true), GREETING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hidden]);

  React.useEffect(() => {
    if (!hidden) return;
    setChatOpen(false);
    setGreetingOpen(false);
  }, [hidden]);

  React.useEffect(() => {
    if (!chatOpen || !transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, chatOpen]);

  React.useEffect(() => {
    if (!chatOpen) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [chatOpen]);

  React.useEffect(() => {
    if (!chatOpen && !greetingOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (chatOpen) setChatOpen(false);
      else dismissGreeting();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [chatOpen, dismissGreeting, greetingOpen]);

  const sendMessage = React.useCallback((value) => {
    const text = String(value || '').trim();
    if (!text) return;

    const reply = getAvalonConciergeReply(text);
    setMessages((current) => [
      ...current,
      buildMessage('user', text),
      buildMessage('bot', reply),
    ]);
    setInput('');
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(input);
  };

  const toggleChat = () => {
    if (!chatOpen) dismissGreeting();
    setChatOpen((value) => !value);
  };

  if (hidden) return null;

  return (
    <div
      className="pointer-events-none fixed right-[max(env(safe-area-inset-right),1rem)] z-[70] flex flex-col items-end transition-[bottom] duration-300 ease-out sm:right-[max(env(safe-area-inset-right),1.5rem)]"
      style={{
        bottom: 'calc(var(--av-cookie-banner-offset, 0px) + var(--av-concierge-press-clearance, 0px) + max(env(safe-area-inset-bottom), 1.25rem))',
      }}
      data-testid="avalon-concierge-widget"
    >
      {chatOpen ? (
        <section
          aria-label="Avalon concierge"
          className="pointer-events-auto mb-3 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-[1.45rem] border border-[#d9d2c8] bg-[#fffdf8] text-[#2b211b] shadow-[0_24px_80px_rgba(43,33,27,0.24)]"
          role="dialog"
        >
          <header className="flex items-start justify-between gap-4 border-b border-[#d9d2c8] px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2b211b] text-[#f6f2eb]">
                <AvalonMark className="h-6 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-[#6e6258]">Avalon Concierge</p>
                <p className="mt-1 font-body text-sm font-semibold leading-snug text-[#2b211b]">How can we help?</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#2b211b] transition-colors hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
              aria-label="Close Avalon concierge"
            >
              <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </header>

          <div ref={transcriptRef} className="max-h-[min(19rem,42dvh)] overflow-y-auto px-3 py-3 sm:px-4">
            {messages.length === 0 ? (
              <div>
                <p className="font-body text-[13px] font-medium leading-relaxed text-[#4f453d]">
                  Ask about services, pricing, booking, memberships, or where we serve. Clinical eligibility is always confirmed by your Avalon nurse.
                </p>
                <div className="mt-3 grid gap-2">
                  {AVALON_CONCIERGE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="min-h-11 rounded-full border border-[#d9d2c8] bg-[#faf7f1] px-4 text-left font-body text-xs font-semibold text-[#2b211b] transition-colors hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5" aria-live="polite">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[88%] rounded-[1.05rem] px-3.5 py-2.5 font-body text-xs font-medium leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-[#2b211b] text-[#fffdf8]'
                          : 'border border-[#d9d2c8] bg-[#faf7f1] text-[#4f453d]'
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#d9d2c8] px-3 py-3 sm:px-4">
            <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-full border border-[#bfb6aa] bg-[#faf7f1] p-1">
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                type="text"
                autoComplete="off"
                className="min-h-11 min-w-0 flex-1 border-0 !bg-transparent px-3 font-body text-sm font-medium text-[#2b211b] placeholder:text-[#6e6258] focus:outline-none"
                placeholder="Ask Avalon"
                aria-label="Ask Avalon concierge"
              />
              <button
                type="submit"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2b211b] text-[#f6f2eb] transition-opacity disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b]"
                disabled={!input.trim()}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <Popover
        open={greetingOpen && !chatOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && greetingOpen) dismissGreeting();
        }}
      >
        <PopoverAnchor asChild>
          <button
            type="button"
            onClick={toggleChat}
            className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border border-[#44372f] bg-[#2b211b] text-[#f6f2eb] shadow-[0_18px_54px_rgba(43,33,27,0.3)] transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2b211b] sm:h-[4.5rem] sm:w-[4.5rem]"
            aria-label={chatOpen ? 'Close Avalon concierge chat' : 'Open Avalon concierge chat'}
          >
            {chatOpen ? (
              <X className="h-7 w-7" strokeWidth={1.8} aria-hidden="true" />
            ) : (
              <MessageCircle className="h-8 w-8" strokeWidth={2} aria-hidden="true" />
            )}
          </button>
        </PopoverAnchor>

        <PopoverContent
          side="top"
          align="end"
          sideOffset={16}
          collisionPadding={16}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="w-[min(31rem,calc(100vw-2rem))] rounded-[1.35rem] border-[#d9d2c8] !bg-[#fffdf8] p-0 !text-[#2b211b] shadow-[0_24px_80px_rgba(43,33,27,0.24)]"
          data-testid="avalon-concierge-greeting"
        >
          <div className="flex items-start gap-4 p-5 pr-14 sm:gap-5 sm:p-6 sm:pr-16">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#2b211b] text-[#f6f2eb] sm:h-16 sm:w-16">
              <AvalonMark className="h-8 w-5 sm:h-9 sm:w-6" />
            </span>
            <p className="font-body text-lg font-medium leading-[1.42] tracking-[-0.015em] text-[#2b211b] sm:text-[1.35rem]">
              Hi there, have a question about our services? Message us here.
            </p>
            <button
              type="button"
              onClick={dismissGreeting}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-[#2b211b] transition-colors hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b211b] sm:right-4 sm:top-4"
              aria-label="Dismiss concierge greeting"
            >
              <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          <PopoverArrow className="fill-[#fffdf8]" height={12} width={24} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
