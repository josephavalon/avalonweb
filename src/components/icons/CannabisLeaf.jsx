import React from 'react';

export default function CannabisLeaf({ className, strokeWidth = 1.2 }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(12 14.2)">
        {/* Center leaflet (tallest) */}
        <path d="M0 0 C -3.4 -3 -3.4 -8.2 0 -11.3 C 3.4 -8.2 3.4 -3 0 0 Z" />
        {/* Upper pair */}
        <g transform="rotate(-40)"><path d="M0 0 C -3.0 -2.8 -3.0 -7.3 0 -10.2 C 3.0 -7.3 3.0 -2.8 0 0 Z" /></g>
        <g transform="rotate(40)"><path d="M0 0 C -3.0 -2.8 -3.0 -7.3 0 -10.2 C 3.0 -7.3 3.0 -2.8 0 0 Z" /></g>
        {/* Middle pair (nearly horizontal) */}
        <g transform="rotate(-80)"><path d="M0 0 C -2.7 -2.4 -2.7 -6.3 0 -9 C 2.7 -6.3 2.7 -2.4 0 0 Z" /></g>
        <g transform="rotate(80)"><path d="M0 0 C -2.7 -2.4 -2.7 -6.3 0 -9 C 2.7 -6.3 2.7 -2.4 0 0 Z" /></g>
        {/* Lower pair */}
        <g transform="rotate(-120)"><path d="M0 0 C -2.3 -2.0 -2.3 -5.3 0 -7.5 C 2.3 -5.3 2.3 -2.0 0 0 Z" /></g>
        <g transform="rotate(120)"><path d="M0 0 C -2.3 -2.0 -2.3 -5.3 0 -7.5 C 2.3 -5.3 2.3 -2.0 0 0 Z" /></g>
      </g>
      {/* Stem */}
      <line x1="12" y1="14.2" x2="12" y2="22" />
    </svg>
  );
}
