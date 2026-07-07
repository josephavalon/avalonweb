import React from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  default: '',
  soft: '',
  command: '',
  selected: 'ring-1 ring-foreground/20',
  heavy: '',
};

const BLUR = {
  soft: '',
  default: '',
  command: '',
  selected: '',
  heavy: '',
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
  'av-glass-card relative overflow-hidden border text-foreground transition-[border-color,background-color,transform] duration-base ease-editorial',
  TONES[tone] || TONES.default,
  BLUR[tone] || BLUR.default,
  RADIUS[radius] || RADIUS['3xl'],
  interactive && 'hover:border-[var(--glass-border-hover)] motion-safe:hover:-translate-y-0.5 motion-safe:hover:scale-[1.01] motion-safe:active:scale-[0.97]',
  className
);

export const GlassCard = React.forwardRef(function GlassCard({
  as: Tag = 'div',
  tone = 'default',
  radius = '3xl',
  interactive = false,
  className = '',
  children,
  ...rest
}, ref) {
  return (
    <Tag
      ref={ref}
      className={glassCardClassName({ tone, radius, interactive, className })}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default GlassCard;
