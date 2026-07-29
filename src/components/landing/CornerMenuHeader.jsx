import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, MessageCircle, Phone, X } from 'lucide-react';
import AvalonMark from '@/components/AvalonMark';

const ITEMS = [
  { label: 'Start', to: '/start' },
  { label: 'Choose', to: '/nurse-delivery?path=guided' },
  { label: 'Menu', to: '/protocols' },
  { label: 'Events', to: '/events' },
];

const PHONE_URL = 'tel:+14159807708';
const TEXT_URL = 'sms:+14159807708';

export default function CornerMenuHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const menuId = useId();
  const menuRef = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsidePress = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
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
            type="button"
            className="nd-corner-menu__toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>

          <nav
            id={menuId}
            className={`nd-corner-menu__panel${open ? ' nd-corner-menu__panel--open' : ''}`}
            aria-label="Primary navigation"
            hidden={!open}
          >
            {ITEMS.map((item) => (
              <Link key={item.label} to={item.to} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
