import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, List } from 'lucide-react';
import AsSeenAt from '@/components/landing/AsSeenAt';
import ConsumerFooter from '@/components/landing/ConsumerFooter';

// One door, not three. The hero used to offer these as three near-identical
// cards, which made the visitor choose before they could act. START is now the
// only card; the other two are ghost pills at an obviously lower tier.
const PRIMARY_PATH = {
  title: 'Start',
  description: 'Care in seconds.',
  to: '/start',
  ariaLabel: 'Start a therapy request with an Avalon concierge',
};

const SECONDARY_PATHS = [
  {
    title: 'Help me choose',
    description: '',
    // A bare glyph, not lucide's HelpCircle: the mark already sits inside a
    // bordered circle, and HelpCircle would draw a second ring inside the first.
    glyph: '?',
    to: '/nurse-delivery?path=guided',
    ariaLabel: 'Get help choosing a therapy',
  },
  {
    title: 'Therapies',
    description: '',
    icon: List,
    to: '/protocols',
    ariaLabel: 'Browse the therapy menu',
  },
];

export default function Hero({ showTail = true, showPress = showTail, enhanced = false }) {
  const sectionRef = useRef(null);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // useLayoutEffect, not useEffect: .nd-reveal-ready must land before the
  // browser paints. Applied after paint, the section shows at full opacity for
  // a frame and then blinks out.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (section && enhanced && !reduceMotion) {
      try {
        if (!window.sessionStorage.getItem('avalon.home.hero-entered.v2')) {
          section.classList.add('nd-hero--enter');
          window.sessionStorage.setItem('avalon.home.hero-entered.v2', '1');
        }
      } catch {
        section.classList.add('nd-hero--enter');
      }
    }

    if (!section || reduceMotion || !('IntersectionObserver' in window)) {
      return undefined;
    }

    const revealTargets = section.querySelectorAll(
      '.nd-hero__paths, .nd-press, .nd-footer__main, .nd-footer__notice',
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('nd-reveal-visible');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -7% 0px',
      },
    );

    const reveal = (target) => {
      target.classList.add('nd-reveal-visible');
      observer.unobserve(target);
    };

    // Fail open.
    //
    // The hidden state now gates pointer-events (an opacity:0 below-fold
    // section otherwise swallows scroll gestures on iOS). That makes a silent
    // observer far more expensive than it used to be: .nd-hero__paths is the
    // homepage's primary CTA, so a target that never receives a callback is a
    // visible-but-unclickable card rather than merely an un-animated one.
    //
    // Observers can stay silent for seconds — a backgrounded tab throttles
    // rendering hard enough to starve the callback, and the page is then
    // restored mid-state. So anything already on screen is revealed manually
    // on a timer, and a passive scroll/resize backstop keeps checking until
    // every target has been dealt with. Losing the animation is acceptable;
    // losing the CTA is not.
    const sweep = () => {
      let remaining = 0;
      revealTargets.forEach((target) => {
        if (target.classList.contains('nd-reveal-visible')) return;
        const rect = target.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) reveal(target);
        else remaining += 1;
      });
      if (remaining === 0) teardownBackstop();
    };

    let backstopAttached = false;
    function teardownBackstop() {
      if (!backstopAttached) return;
      backstopAttached = false;
      window.removeEventListener('scroll', sweep);
      window.removeEventListener('resize', sweep);
    }

    revealTargets.forEach((target) => {
      target.classList.add('nd-reveal-ready');
      observer.observe(target);
    });

    const failOpen = window.setTimeout(() => {
      sweep();
      if (![...revealTargets].every((t) => t.classList.contains('nd-reveal-visible'))) {
        backstopAttached = true;
        window.addEventListener('scroll', sweep, { passive: true });
        window.addEventListener('resize', sweep);
      }
    }, 1200);

    return () => {
      window.clearTimeout(failOpen);
      teardownBackstop();
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`nd-hero${enhanced ? ' nd-hero--enhanced' : ''}`}
      aria-labelledby="nd-hero-title"
    >
      <div className="nd-hero__split">
        <div className="nd-hero__editorial">
          <div className="nd-hero__mobile-panel">
            <div className="nd-hero__message">
              <h1 id="nd-hero-title">
                <span className="nd-hero__headline-desktop">Wellness Delivered</span>
                <span className="nd-hero__headline-mobile">Wellness Delivered</span>
              </h1>
              <p className="nd-hero__tagline">
                <span className="nd-hero__tagline-desktop">
                  IV therapies and more.
                  <br />
                  By registered nurses.
                  <br />
                  On-demand.
                </span>
                <span className="nd-hero__tagline-mobile">
                  IV therapies. Registered nurses.
                  <br />
                  On-demand.
                </span>
              </p>
              <p className="nd-hero__lede">Mobile IVs and more.</p>
            </div>
          </div>

          <div className="nd-hero__visual nd-hero__visual--mobile">
            <img
              src="/images/avalon-nurse-delivery-hero-v2.webp"
              alt="Avalon mobile nurse arriving with a folded IV stand at a Bay Area residence"
              className="nd-hero__image"
              width="841"
              height="1870"
              fetchpriority="high"
              decoding="async"
            />
          </div>

          <nav className="nd-hero__paths" aria-label="Choose how to begin">
            <Link
              to={PRIMARY_PATH.to}
              className="nd-path nd-path--primary"
              aria-label={PRIMARY_PATH.ariaLabel}
            >
              <span className="nd-path__copy">
                <strong>{PRIMARY_PATH.title}</strong>
                <span className="nd-path__description">{PRIMARY_PATH.description}</span>
              </span>
              <span className="nd-path__action" aria-hidden="true">
                <ArrowRight />
              </span>
            </Link>

            {/* Inside the nav, not after it: .nd-hero__editorial distributes its
                own children, which strands these at the bottom of the column,
                hundreds of px from the button they belong to. */}
            <div className="nd-hero__ghosts">
              {SECONDARY_PATHS.map((path) => (
                <Link
                  key={path.title}
                  to={path.to}
                  className="nd-ghost"
                  aria-label={path.ariaLabel}
                >
                  <span className="nd-ghost__icon" aria-hidden="true">
                    {path.icon ? <path.icon /> : path.glyph}
                  </span>
                  <span className="nd-ghost__copy">
                    <strong>{path.title}</strong>
                    {path.description ? <span className="nd-ghost__description">{path.description}</span> : null}
                  </span>
                  {/* Mobile only. On desktop the two cells sit side by side and
                      the hairline between them carries the affordance; stacked
                      as full-width rows they read as list items without it. */}
                  <span className="nd-ghost__arrow" aria-hidden="true">
                    <ArrowRight />
                  </span>
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <div className="nd-hero__visual nd-hero__visual--desktop">
          <img
            src="/images/avalon-nurse-delivery-hero.webp"
            alt="Avalon mobile nurse arriving with a folded IV stand at a Bay Area residence"
            className="nd-hero__image"
            width="2400"
            height="1350"
            fetchpriority="high"
            decoding="async"
          />
        </div>
      </div>

      <div className="nd-hero__trust-strip" aria-label="Avalon care standards">
        <span>Licensed nurses</span>
        <span>Private</span>
        <span>Human verified</span>
      </div>

      {showPress ? (
        <div className="nd-press">
          <AsSeenAt tone="light" />
        </div>
      ) : null}

      {showTail ? <ConsumerFooter /> : null}
    </section>
  );
}
