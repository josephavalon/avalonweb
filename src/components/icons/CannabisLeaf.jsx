import React from 'react';

// 7-leaflet cannabis leaf — outlined line art matching customer reference.
// strokeWidth hardcoded to 1 so parent lucide-style prop cannot fatten the outline.
export default function CannabisLeaf({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(16 20)">
        {/* Center leaflet - tallest, narrow pointed tip */}
        <path d="M0 0 C -3.2 -4 -4 -11 0 -17 C 4 -11 3.2 -4 0 0 Z" />
        {/* Upper-left / upper-right */}
        <g transform="rotate(-32)"><path d="M0 0 C -3 -3.5 -3.8 -10 0 -15.2 C 3.8 -10 3 -3.5 0 0 Z" /></g>
        <g transform="rotate(32)"><path d="M0 0 C -3 -3.5 -3.8 -10 0 -15.2 C 3.8 -10 3 -3.5 0 0 Z" /></g>
        {/* Middle-left / middle-right - nearly horizontal */}
        <g transform="rotate(-72)"><path d="M0 0 C -2.6 -3 -3.4 -8.5 0 -13 C 3.4 -8.5 2.6 -3 0 0 Z" /></g>
        <g transform="rotate(72)"><path d="M0 0 C -2.6 -3 -3.4 -8.5 0 -13 C 3.4 -8.5 2.6 -3 0 0 Z" /></g>
        {/* Lower pair - short, angled downward */}
        <g transform="rotate(-118)"><path d="M0 0 C -2.2 -2.5 -2.8 -6.5 0 -10 C 2.8 -6.5 2.2 -2.5 0 0 Z" /></g>
        <g transform="rotate(118)"><path d="M0 0 C -2.2 -2.5 -2.8 -6.5 0 -10 C 2.8 -6.5 2.2 -2.5 0 0 Z" /></g>
      </g>
      {/* Stem */}
      <line x1="16" y1="20" x2="16" y2="29" />
    </svg>
  );
}
