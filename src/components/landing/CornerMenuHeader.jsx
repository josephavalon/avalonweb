import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, MessageCircle, Phone, X } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';
import { AnimatePresence, motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { DURATIONS, EASE } from '@/lib/motion';
import { isFrontDoorHost } from '@/lib/frontDoor';

// This header is global — it renders on the front door AND on beta, so the two
// surfaces get two item lists rather than one edited list. Beta carries the full
// Avalon OS, so its Login goes to /login.
//
// Both surfaces use the unified login. On the public front door it opens on the
// staff view so Nurse and Admin are immediately visible; members and event
// organizers can still switch portals from the same page.
const OS_ITEMS = [
  { label: 'Start', to: '/start' },
  { label: 'Help', to: '/nurse-delivery?path=guided' },
  { label: 'Menu', to: '/protocols' },
  { label: 'Events', to: '/events' },
  { label: 'Login', to: '/login' },
];

const FRONT_DOOR_ITEMS = [
  { label: 'Start', to: '/start' },
  { label: 'Help', to: '/nurse-delivery?path=guided' },
  { label: 'Menu', to: '/protocols' },
  { label: 'Events', to: '/events' },
  { label: 'Login', to: '/login?role=nurse' },
];

const PHONE_URL = 'tel:+14159807708';
const TEXT_URL = 'sms:+14159807708';

export default function CornerMenuHeader() {
  const [open, setOpen] = useState(false);
  // Host read taken once via the useState initializer, same technique as
  // FrontDoorRedirect, so the first render already shows the right menu.
  const [items] = useState(() => (isFrontDoorHost() ? FRONT_DOOR_ITEMS : OS_ITEMS));
  const { pathname } = useLocation();
  const menuId = useId();
  const menuRef = useRef(null);
  const toggleRef = useRef(null);
  const reduceMotion = useReducedMotion();

  // Panel opens from the toggle in the top-right corner. Transform + opacity
  // only — this header is fixed chrome, so nothing here may introduce a
  // containing block on an ancestor (see PageTransition.jsx:5-17). The panel
  // is position:absolute inside the header, which is safe.
  const panelMotion = reduceMotion
    ? {
        initial: { opacity: 0, transition: { duration: 0 } },
        animate: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      }
    : {
        initial: { opacity: 0, scale: 0.98, y: -4 },
        animate: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { duration: DURATIONS.quick, ease: EASE, staggerChildren: 0.028, delayChildren: 0.04 },
        },
        exit: { opacity: 0, scale: 0.98, y: -4, transition: { duration: 0.16, ease: EASE } },
      };

  const itemMotion = reduceMotion
    ? {}
    : {
        variants: {
          initial: { opacity: 0, y: -6 },
          animate: { opacity: 1, y: 0, transition: { duration: DURATIONS.quick, ease: EASE } },
          exit: { opacity: 0 },
        },
      };

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsidePress = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Escape must not strand focus on a node that is about to unmount.
      toggleRef.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <header className="nd-corner-header">
      <Link to="/" className="nd-corner-header__brand" aria-label="Avalon Vitality home">
        <AvalonMark className="nd-corner-header__mark" />
        <span className="nd-corner-header__wordmark" aria-hidden="true">
          Avalon Vitality
        </span>
      </Link>

      <div className="nd-corner-header__actions">
        <div className="nd-corner-header__contact" aria-label="Contact Avalon Vitality">
          <a href={TEXT_URL} aria-label="Text Avalon Vitality">
            <MessageCircle aria-hidden="true" />
          </a>
          <a href={PHONE_URL} aria-label="Call Avalon Vitality">
            <Phone aria-hidden="true" />
          </a>
        </div>

        <div ref={menuRef} className="nd-corner-menu">
          <button
            ref={toggleRef}
            type="button"
            className="nd-corner-menu__toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="nd-corner-menu__glyph" aria-hidden="true">
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={open ? 'close' : 'open'}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -45 }}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, rotate: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: 45 }}
                  transition={{ duration: reduceMotion ? 0 : 0.11, ease: EASE }}
                >
                  {open ? <X /> : <Menu />}
                </motion.span>
              </AnimatePresence>
            </span>
          </button>

          {/* AnimatePresence unmounts the panel when closed, so it leaves the
              accessibility tree entirely — the same guarantee the `hidden`
              attribute was providing, without the hard display:none pop. */}
          <AnimatePresence>
            {open && (
              <motion.nav
                id={menuId}
                className="nd-corner-menu__panel nd-corner-menu__panel--open"
                aria-label="Primary navigation"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={panelMotion}
              >
                {items.map((item) => (
                  <motion.div key={item.label} {...itemMotion}>
                    <Link to={item.to} onClick={() => setOpen(false)}>
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </motion.nav>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
