import React from 'react';

// Avalon shamrock/drop mark. Rendered via CSS mask of /avalon-logo.svg so it
// inherits the current text color (white on dark) — an <img> of the SVG can't
// pick up currentColor. Size it with width/height utility classes; aspect of
// the source mark is ~0.646 (346 x 535).
export default function AvalonMark({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        backgroundColor: 'currentColor',
        WebkitMaskImage: 'url(/avalon-logo.svg)',
        maskImage: 'url(/avalon-logo.svg)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}
