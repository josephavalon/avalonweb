import React from 'react';
import LegalPageShell from '../components/landing/LegalPageShell';

const SECTIONS = [
  {
    h: 'What cookies are',
    p: [
      'Cookies are small text files placed on your device when you visit a website. They allow the site to recognize your device and remember things about your visit (such as your settings, login state, and how you arrived at the site).',
      'This Cookie Policy describes how Avalon Vitality ("Avalon," "we," "us") uses cookies and similar technologies on avalonvitality.co and within Avalon OS.',
    ],
  },
  {
    h: 'Categories of cookies we use',
    p: [
      'Strictly necessary cookies. Required for the Services to function (authentication, security, basic navigation, load balancing). These cannot be turned off.',
      'Analytics cookies. Help us understand how visitors use the Services so we can improve them. These are aggregated and do not identify you individually.',
      'Functional cookies. Remember your preferences (theme, language, dismissed banners) so the Services work the way you expect.',
      'We do not use advertising cookies and we do not engage in cross-context behavioral advertising as defined by the California Privacy Rights Act.',
    ],
  },
  {
    h: 'Similar technologies',
    p: [
      'In addition to cookies, we may use local storage, session storage, pixel tags, and software development kits (SDKs) for the same purposes described above. References to "cookies" in this Policy include those technologies.',
    ],
  },
  {
    h: 'Your choices',
    p: [
      'When you first visit avalonvitality.co you will see a cookie banner allowing you to accept or decline non-essential cookies. You can change your choice at any time through the same banner.',
      'You can also manage cookies through your browser settings. Most browsers let you block or delete cookies. Note that disabling strictly necessary cookies may break parts of the Services.',
      'We honor "Do Not Track" and Global Privacy Control signals where reasonably feasible.',
    ],
  },
  {
    h: 'Third-party cookies',
    p: [
      'Some cookies are placed by third parties acting on our behalf (for example, our analytics provider and our hosting platform). Those third parties are contractually obligated to use the data only for the purposes we direct and not for their own marketing.',
    ],
  },
  {
    h: 'California-specific notice',
    p: [
      'California residents have the right to know what cookies are used and to opt out of the sale or sharing of personal information. Avalon does not sell personal information and does not "share" it for cross-context behavioral advertising as defined by the CPRA.',
    ],
  },
  {
    h: 'Changes to this policy',
    p: [
      'We may update this Cookie Policy from time to time. The "Last updated" date at the top of this page reflects the most recent version.',
    ],
  },
  {
    h: 'Contact',
    p: [
      'Questions about cookies: privacy@avalonvitality.co · (415) 980-7708',
    ],
  },
];

export default function CookiePolicy() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Cookie Policy"
      lastUpdated="April 26, 2026"
      sections={SECTIONS}
      related={[
        { to: '/privacy-policy', label: 'Privacy Policy' },
        { to: '/terms-and-conditions', label: 'Terms of Service' },
        { to: '/notice-of-privacy-practices', label: 'Notice of Privacy Practices' },
      ]}
    />
  );
}
