import React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const heightClass = {
  compact: 'min-h-[120px] md:min-h-[150px]',
  default: 'min-h-[144px] md:min-h-[180px]',
  feature: 'min-h-[168px] md:min-h-[220px]',
};

export default function UniversalCard({
  as: Element = 'div',
  className = '',
  children,
  eyebrow,
  title,
  subtitle,
  meta,
  media,
  icon: Icon,
  action = true,
  selected = false,
  size = 'default',
  ...props
}) {
  return (
    <Element
      className={cn(
        'av-universal-card av-glass-card group relative flex w-full min-w-0 overflow-hidden rounded-[1.45rem] border text-left transition-colors duration-500 hover:border-[var(--glass-border-hover)]',
        heightClass[size] || heightClass.default,
        selected && 'ring-1 ring-foreground/20',
        className
      )}
      {...props}
    >
      {media ? (
        <span className="absolute inset-y-0 right-0 w-[48%] overflow-hidden md:w-[44%]" aria-hidden="true">
          {media}
        </span>
      ) : null}
      {media ? <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/88 via-background/62 to-background/14" /> : null}
      <span className="relative z-10 flex min-w-0 flex-1 items-center gap-4 p-4 md:p-5">
        {Icon ? (
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-foreground/14 bg-foreground/[0.06] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] sm:flex">
            <Icon className="h-6 w-6" strokeWidth={2.25} />
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          {eyebrow ? <span className="mb-1 block font-body text-[10px] font-black uppercase tracking-[0.18em] text-foreground/48">{eyebrow}</span> : null}
          {title ? <span className="block font-heading text-[2.7rem] uppercase leading-[0.88] tracking-normal text-foreground md:text-[3.6rem]">{title}</span> : null}
          {subtitle ? <span className="mt-2 block max-w-[28ch] font-body text-sm font-bold leading-tight text-foreground/66 md:text-base">{subtitle}</span> : null}
          {meta ? <span className="mt-3 block font-body text-[11px] font-black uppercase tracking-[0.14em] text-foreground/52">{meta}</span> : null}
          {children}
        </span>
        {action ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/14 bg-background/36 text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)] transition-transform group-hover:translate-x-1">
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
          </span>
        ) : null}
      </span>
    </Element>
  );
}
