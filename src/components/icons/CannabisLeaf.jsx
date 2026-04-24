import React from 'react';

export default function CannabisLeaf({ className, strokeWidth = 1.25 }) {
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
      <g transform="translate(12 14)">
        {/* Center (tallest) */}
        <path d="M0 0 Q -2.1 -5.5 0 -11.5 Q 2.1 -5.5 0 0 Z" />
        {/* Upper pair */}
        <g transform="rotate(-38)"><path d="M0 0 Q -1.9 -5 0 -10.3 Q 1.9 -5 0 0 Z" /></g>
        <g transform="rotate(38)"><path d="M0 0 Q -1.9 -5 0 -10.3 Q 1.9 -5 0 0 Z" /></g>
        {/* Middle pair */}
        <g transform="rotate(-76)"><path d="M0 0 Q -1.8 -4.5 0 -9.2 Q 1.8 -4.5 0 0 Z" /></g>
        <g transform="rotate(76)"><path d="M0 0 Q -1.8 -4.5 0 -9.2 Q 1.8 -4.5 0 0 Z" /></g>
        {/* Lower pair */}
        <g transform="rotate(-115)"><path d="M0 0 Q -1.6 -4 0 -8 Q 1.6 -4 0 0 Z" /></g>
        <g transform="rotate(115)"><path d="M0 0 Q -1.6 -4 0 -8 Q 1.6 -4 0 0 Z" /></g>
      </g>
      {/* Stem */}
      <line x1="12" y1="14" x2="12" y2="21.5" />
    </svg>
  );
}
