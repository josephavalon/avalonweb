import React from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  default: 'border-foreground/[0.12] bg-background/38 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.11),0_22px_86px_hsl(var(--foreground)/0.08)]',
  soft: 'border-foreground/[0.08] bg-background/30 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08),0_14px_54px_hsl(var(--foreground)/0.045)]',
  command: 'border-foreground/[0.13] bg-background/58 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_28px_110px_hsl(var(--foreground)/0.12)]',
  selected: 'border-accent/35 bg-accent/[0.075] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_24px_90px_hsl(var(--accent)/0.13)]',
  heavy: 'border-foreground/[0.14] bg-background/48 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.13),0_30px_120px_hsl(var(--foreground)/0.12)]',
};

const BLUR = {
  soft: 'backdrop-blur-md',
  default: 'backdrop-blur-xl',
  command: 'backdrop-blur-2xl',
  selected: 'backdrop-blur-xl',
  heavy: 'backdrop-blur-2xl',
};

const RADIUS = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
  '1.25rem': 'rounded-[1.25rem]',
  '1.35rem': 'rounded-[1.35rem]',
  '1.5rem': 'rounded-[1.5rem]',
  '1.55rem': 'rounded-[1.55rem]',
  '1.75rem': 'rounded-[1.75rem]',
};

export const glassCardClassName = ({
  tone = 'default',
  radius = '3xl',
  interactive = false,
  className = '',
} = {}) => cn(
  'av-glass-card relative overflow-hidden border text-foreground backdrop-saturate-150 transition-colors duration-500 ease-editorial',
  TONES[tone] || TONES.default,
  BLUR[tone] || BLUR.default,
  RADIUS[radius] || RADIUS['3xl'],
  interactive && 'hover:border-foreground/24 hover:bg-background/54',
  className
);

export function GlassCard({
  as: Tag = 'div',
  tone = 'default',
  radius = '3xl',
  interactive = false,
  className = '',
  children,
  ...rest
}) {
  return (
    <Tag
      className={glassCardClassName({ tone, radius, interactive, className })}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,hsl(var(--foreground)/0.11),transparent_38%),radial-gradient(circle_at_88%_100%,hsl(var(--foreground)/0.05),transparent_36%),linear-gradient(145deg,hsl(var(--foreground)/0.045),transparent_55%,hsl(var(--foreground)/0.026))]"
      />
      {children}
    </Tag>
  );
}

export default GlassCard;
