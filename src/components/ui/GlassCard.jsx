import React from 'react';

const TONES = {
  default: 'border-white/10 bg-white/[0.035] shadow-[0_18px_70px_hsl(var(--foreground)/0.04)]',
  soft: 'border-foreground/[0.08] bg-foreground/[0.025] shadow-[0_14px_48px_hsl(var(--foreground)/0.025)]',
  command: 'border-foreground/[0.12] bg-background/70 shadow-[0_24px_90px_hsl(var(--foreground)/0.10)]',
  selected: 'border-accent/35 bg-accent/[0.075] shadow-[0_24px_90px_hsl(var(--accent)/0.13)]',
  heavy: 'border-white/12 bg-white/[0.055] shadow-[0_24px_90px_hsl(var(--foreground)/0.08)]',
};

const BLUR = {
  soft: 'backdrop-blur-md',
  default: 'backdrop-blur-xl',
  command: 'backdrop-blur-2xl',
  selected: 'backdrop-blur-xl',
  heavy: 'backdrop-blur-2xl',
};

export function GlassCard({
  as: Tag = 'div',
  tone = 'default',
  radius = '3xl',
  className = '',
  children,
  ...rest
}) {
  const surface = TONES[tone] || TONES.default;
  const blur = BLUR[tone] || BLUR.default;
  const rounded =
    radius === 'xl' ? 'rounded-xl' :
    radius === '2xl' ? 'rounded-2xl' :
    radius === 'lg' ? 'rounded-lg' :
    'rounded-3xl';
  return (
    <Tag
      className={`border ${surface} ${blur} ${rounded} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default GlassCard;
