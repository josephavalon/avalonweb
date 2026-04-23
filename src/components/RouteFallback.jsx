import React from 'react';

/**
 * Suspense fallback shown while a lazy route chunk is fetching.
 * Keeps the brand background so there's no flash-of-white, and a single
 * thin spinner so the UI doesn't feel frozen.
 */
export default function RouteFallback() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="w-8 h-8 border border-border border-t-foreground rounded-full animate-spin" />
    </div>
  );
}
