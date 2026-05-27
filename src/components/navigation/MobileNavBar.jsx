import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const GRID_CLASS = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

const MAX_WIDTH_CLASS = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  shift: 'max-w-[512px]',
};

const Z_INDEX_CLASS = {
  default: 'z-50',
  low: 'z-30',
  high: 'z-[100]',
};

const shellBackground = 'linear-gradient(180deg, transparent, hsl(var(--background) / 0.96) 24%)';

function resolveActive(pathname, item) {
  if (typeof item.active === 'boolean') return item.active;
  if (!item.to) return false;
  if (item.exact || item.to === '/') return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function renderAction(item, children, className, style, ariaCurrent, key) {
  if (item.href) {
    return (
      <a key={key} href={item.href} className={className} style={style} aria-current={ariaCurrent}>
        {children}
      </a>
    );
  }

  if (item.onClick || item.disabled) {
    return (
      <button
        key={key}
        type="button"
        onClick={item.onClick}
        disabled={item.disabled}
        className={className}
        style={style}
        aria-current={ariaCurrent}
      >
        {children}
      </button>
    );
  }

  return (
    <Link key={key} to={item.to || '#'} className={className} style={style} aria-current={ariaCurrent}>
      {children}
    </Link>
  );
}

export default function MobileNavBar({
  items,
  ariaLabel,
  columns,
  maxWidth = 'md',
  className = '',
  mobileOnly = true,
  zIndex = 'default',
}) {
  const { pathname } = useLocation();
  const gridClass = GRID_CLASS[columns || items.length] || 'grid-cols-4';
  const maxWidthClass = MAX_WIDTH_CLASS[maxWidth] || MAX_WIDTH_CLASS.md;
  const zIndexClass = Z_INDEX_CLASS[zIndex] || Z_INDEX_CLASS.default;

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 ${zIndexClass} px-3 pt-2 backdrop-blur-2xl ${mobileOnly ? 'md:hidden' : ''} ${className}`}
      aria-label={ariaLabel}
      style={{
        background: shellBackground,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.7rem)',
      }}
    >
      <div className={`mx-auto grid ${maxWidthClass} ${gridClass} gap-1.5 rounded-[24px] border border-foreground/[0.10] bg-background/82 p-1.5 shadow-[0_-18px_54px_rgba(0,0,0,0.34)]`}>
        {items.map((item) => {
          const active = resolveActive(pathname, item);
          const Icon = item.icon;
          const primary = Boolean(item.primary);
          const disabled = Boolean(item.disabled);
          const itemStyle = {
            background: primary ? 'transparent' : active ? 'hsl(var(--foreground) / 0.075)' : 'transparent',
            border: `1px solid ${active && !primary ? 'hsl(var(--foreground) / 0.18)' : 'transparent'}`,
            color: primary ? 'hsl(var(--foreground))' : active ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.58)',
          };
          const content = (
            <>
              <span
                className="relative flex h-9 w-11 items-center justify-center rounded-full transition-colors"
                style={{
                  background: primary ? 'hsl(var(--foreground))' : active ? 'hsl(var(--foreground) / 0.07)' : 'transparent',
                  color: primary ? 'hsl(var(--background))' : active ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.48)',
                  boxShadow: primary ? '0 10px 30px hsl(var(--foreground) / 0.18)' : 'none',
                }}
              >
                {Icon && <Icon className="h-5 w-5" strokeWidth={primary || active ? 1.95 : 1.55} />}
                {item.badge ? (
                  <span className="absolute right-1.5 top-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-accent px-[3px] font-body text-[8px] font-bold text-background">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </span>
              <span
                className="font-body text-[8px] font-bold uppercase leading-none tracking-[0.14em]"
                style={{ color: primary || active ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.58)' }}
              >
                {item.label}
              </span>
            </>
          );

          return renderAction(
            { ...item, disabled },
            content,
            `flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center transition-all duration-200 active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/35 disabled:pointer-events-none disabled:opacity-40 ${item.className || ''}`,
            itemStyle,
            active ? 'page' : undefined,
            item.to || item.href || item.label
          );
        })}
      </div>
    </nav>
  );
}
