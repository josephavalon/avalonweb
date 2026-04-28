import React from 'react';

// Single source of truth for the glass surface used across the site.
// Defaults: border-white/10, bg-white/[0.03], backdrop-blur-md, rounded-3xl.
// Use `tone="heavy"` for emphasized cards (Membership tiers, partner cards).
// Use `radius="2xl" | "3xl" | "xl" | "lg"` to match the host section.
//
// Usage: <GlassCard className="p-5 flex flex-col gap-4">...</GlassCard>
export function GlassCard({
  as: Tag = 'div',
  tone = 'default',
  radius = '3xl',
  className = '',
  children,
  ...rest
}) {
  const surface = tone === 'heavy' ? 'bg-white/[0.04]' : 'bg-white/[0.03]';
  const rounded =
    radius === 'xl' ? 'rounded-xl' :
    radius === '2xl' ? 'rounded-2xl' :
    radius === 'lg' ? 'rounded-lg' :
    'rounded-3xl';
  return (
    <Tag
      className={`border border-white/10 ${surface} backdrop-blur-md ${rounded} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default GlassCard;
