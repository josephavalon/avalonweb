import React from 'react';
import { motion } from 'framer-motion';
import { Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';

// Brand marks not in lucide — minimal inline SVGs
function XIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function TikTokIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.79a8.16 8.16 0 0 0 4.77 1.52V6.85a4.85 4.85 0 0 1-1.84-.16Z"/>
    </svg>
  );
}
function ThreadsIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.471 12.01v-.02c.03-3.577.879-6.43 2.525-8.482C5.846 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.78 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.74-1.757-.503-.586-1.279-.883-2.309-.884H12.51c-.828 0-1.957.227-2.679 1.301L8.069 8.032c.97-1.443 2.546-2.234 4.443-2.234h.024c3.17.02 5.058 1.957 5.247 5.331.108.046.216.094.32.143 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.273 2.65zm1.522-9.756c-.345 0-.696.013-1.054.04-1.84.103-2.991.95-2.917 2.143.07 1.243 1.435 1.815 2.708 1.747 1.171-.062 2.71-.484 2.997-3.598a10.5 10.5 0 0 0-1.734-.332Z"/>
    </svg>
  );
}
function GoogleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M21.35 11.1H12v3.2h5.35c-.5 2.5-2.7 4.3-5.35 4.3a5.6 5.6 0 1 1 0-11.2c1.4 0 2.7.5 3.7 1.4l2.4-2.3A8.9 8.9 0 0 0 12 3.2 8.8 8.8 0 1 0 12 21c5.1 0 8.8-3.6 8.8-8.7 0-.4 0-.9-.1-1.2Z"/>
    </svg>
  );
}
function YelpIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M14.16.62a.84.84 0 0 0-.94-.55l-3.7 1A.84.84 0 0 0 9 2v9.9a.84.84 0 0 0 1.43.62l5.86-5.83a.84.84 0 0 0 .14-1.05zM21.45 13.05l-4.6-1.32a.84.84 0 0 0-1.07.74l-.06 4.5a.84.84 0 0 0 1.16.79l4.4-1.86a.84.84 0 0 0 .17-1.49zM18.3 19.85l-2.4-2.9a.84.84 0 0 0-1.39.13l-1.95 4.06a.84.84 0 0 0 .98 1.18l3.36-.9a.84.84 0 0 0 .92-.57zM10.5 16.4l-3.6-2.6A.84.84 0 0 0 5.6 14l-2.32 4.16a.84.84 0 0 0 .57 1.24l3.71.9a.84.84 0 0 0 .93-.4l1.98-3.36a.84.84 0 0 0 .03-.13zM7.84 11.83 3.4 8.55a.84.84 0 0 0-1.31.43L1 12.43a.84.84 0 0 0 .76 1.07l5.71.43a.84.84 0 0 0 .37-1.6z"/>
    </svg>
  );
}

const PLATFORMS = [
  { label: 'Instagram',    href: 'https://instagram.com/avalonvitality',           Icon: Instagram },
  { label: 'Facebook',     href: 'https://facebook.com/avalonvitality',            Icon: Facebook },
  { label: 'YouTube',      href: 'https://youtube.com/@avalonvitality',            Icon: Youtube },
  { label: 'TikTok',       href: 'https://tiktok.com/@avalonvitality',             Icon: TikTokIcon },
  { label: 'X',            href: 'https://x.com/avalonvitality',                   Icon: XIcon },
  { label: 'Threads',      href: 'https://threads.net/@avalonvitality',            Icon: ThreadsIcon },
  { label: 'LinkedIn',     href: 'https://linkedin.com/company/avalonvitality',    Icon: Linkedin },
  { label: 'Google',       href: 'https://g.page/avalonvitality',                  Icon: GoogleIcon },
  { label: 'Yelp',         href: 'https://yelp.com/biz/avalonvitality-san-francisco', Icon: YelpIcon },
];

const EASE = [0.16, 1, 0.3, 1];

export default function SocialLinks() {
  return (
    <div className="mt-10 md:mt-14 max-w-3xl mx-auto">
      <p className="text-xs md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-4 md:mb-5 text-center">
        Follow Avalon
      </p>
      <div className="flex flex-wrap justify-center gap-3 md:gap-4">
        {PLATFORMS.map(({ label, href, Icon }, i) => (
          <motion.a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Avalon Vitality on ${label}`}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.5, delay: i * 0.04, ease: EASE }}
            className="group relative w-16 h-16 md:w-20 md:h-20 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md flex items-center justify-center text-foreground/80 hover:text-accent hover:border-accent/50 hover:bg-white/[0.08] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          >
            <Icon className="w-6 h-6 md:w-8 md:h-8" />
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] md:text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-body opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
              {label}
            </span>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
