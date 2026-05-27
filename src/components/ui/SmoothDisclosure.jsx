import React from 'react';

export default function SmoothDisclosure({
  open,
  children,
  className = '',
  innerClassName = '',
}) {
  return (
    <div
      data-smooth-disclosure=""
      data-open={open ? 'true' : 'false'}
      aria-hidden={!open}
      {...(!open ? { inert: '' } : {})}
      className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      } ${className}`}
      style={{
        pointerEvents: open ? 'auto' : 'none',
        transitionTimingFunction: 'cubic-bezier(0.25,0.1,0.25,1)',
      }}
    >
      <div className={`min-h-0 overflow-hidden ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}
