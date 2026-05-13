import React from 'react';
import { Instagram, Youtube, Facebook, Linkedin } from 'lucide-react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

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
  { label: 'Instagram', href: 'https://instagram.com/avalonvitality',              Icon: Instagram  },
  { label: 'TikTok',   href: 'https://tiktok.com/@avalonvitality',                Icon: TikTokIcon },
  { label: 'YouTube',  href: 'https://youtube.com/@avalonvitality',               Icon: Youtube    },
  { label: 'X',        href: 'https://x.com/avalonvitality',                      Icon: XIcon      },
  { label: 'Facebook', href: 'https://facebook.com/avalonvitality',               Icon: Facebook   },
  { label: 'LinkedIn', href: 'https://linkedin.com/company/avalonvitality',       Icon: Linkedin   },
  { label: 'Google',   href: 'https://g.page/avalonvitality',                     Icon: GoogleIcon },
  { label: 'Yelp',     href: 'https://yelp.com/biz/avalonvitality-san-francisco', Icon: YelpIcon   },
];

export default function SocialLinks() {
  return (
    <div className="mt-10 md:mt-14 w-full">
      <p className="text-[13px] md:text-sm tracking-[0.3em] text-accent font-body uppercase mb-8 md:mb-10 text-left">
        Follow Avalon
      </p>
      <div className="grid grid-cols-4 md:grid-cols-8 gap-4 md:gap-6">
        {PLATFORMS.map(({ label, href, Icon }, i) => (
          <motion.a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Avalon Vitality on ${label}`}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: EASE, delay: i * 0.04 }}
            className="flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors duration-200"
          >
            <Icon className="w-8 h-8 md:w-9 md:h-9" strokeWidth={1.25} />
          </motion.a>
        ))}
      </div>
    </div>
  );
}
