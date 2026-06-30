import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

// ClinicalTrustStrip — surfaces real clinician identity at decision moments
// (hero, booking summary, checkout rail, confirmation, protocol detail).
// One generic "Registered Nurses" line doesn't earn trust; named credentials
// + the review guarantee do. Data mirrors OurTeam.jsx CLINICAL array; kept
// in-component for now since only two records exist. Lift to /src/data/team.js
// if a third surface needs to override.

const CLINICIANS = [
  {
    initials: 'JW',
    name: 'Jayson Weir, MD',
    role: 'Medical Director',
  },
  {
    initials: 'SW',
    name: 'Stephanie Weeks, RN',
    role: 'Director of Nursing',
  },
];

function Avatar({ initials, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 bg-foreground/8 font-heading text-[12px] font-black uppercase tracking-[0.06em] text-foreground/82 ${className}`}
    >
      {initials}
    </span>
  );
}

/**
 * variant:
 *   - 'full'    — homepage / trust pages: both clinicians, names + roles, review line
 *   - 'compact' — booking / checkout / confirmation / protocol detail: one row,
 *                 names + review line, no roles
 *   - 'inline'  — single line for tight rails (e.g. checkout summary)
 */
export default function ClinicalTrustStrip({ variant = 'compact', className = '', linkToTeam = true }) {
  const containerBase =
    'flex items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2.5';

  if (variant === 'inline') {
    return (
      <p className={`flex items-center gap-2 font-body text-[12px] font-bold uppercase leading-snug tracking-[0.08em] text-foreground/64 ${className}`}>
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-foreground/70" strokeWidth={2} aria-hidden="true" />
        <span>Clinically reviewed before every visit · {CLINICIANS[0].name}, {CLINICIANS[1].name}</span>
      </p>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`${containerBase} ${className}`}>
        <div className="flex -space-x-2">
          {CLINICIANS.map((c) => (
            <Avatar key={c.initials} initials={c.initials} />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[12px] font-black uppercase leading-tight tracking-[0.08em] text-foreground/82">
            Reviewed by {CLINICIANS[0].name} · Administered by {CLINICIANS[1].name}
          </p>
          <p className="mt-0.5 font-body text-[11px] leading-snug text-foreground/56">
            Every visit clinically reviewed before nurse dispatch.{' '}
            {linkToTeam && (
              <Link to="/team" className="inline-flex min-h-[44px] items-center text-foreground/72 underline-offset-2 hover:underline">
                Meet the team
              </Link>
            )}
          </p>
        </div>
      </div>
    );
  }

  // full
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4 sm:flex-row sm:items-center sm:gap-5 ${className}`}>
      <div className="flex items-center gap-3">
        {CLINICIANS.map((c) => (
          <div key={c.initials} className="flex items-center gap-2">
            <Avatar initials={c.initials} className="h-11 w-11 text-[13px]" />
            <div className="min-w-0">
              <p className="font-body text-[12px] font-black uppercase leading-tight tracking-[0.06em] text-foreground">
                {c.name}
              </p>
              <p className="font-body text-[11px] leading-snug text-foreground/56">
                {c.role}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="sm:ml-auto sm:max-w-[18rem]">
        <p className="font-body text-[12px] leading-snug text-foreground/64">
          <ShieldCheck className="mr-1.5 inline-block h-3.5 w-3.5 align-[-2px] text-foreground/72" strokeWidth={2} aria-hidden="true" />
          Every visit is clinically reviewed before a nurse is dispatched.{' '}
          {linkToTeam && (
            <Link to="/team" className="inline-flex min-h-[44px] items-center text-foreground/82 underline-offset-2 hover:underline">
              Meet the team
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}
