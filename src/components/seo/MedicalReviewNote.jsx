import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { MEDICAL_REVIEW } from '@/data/seoArchitecture';

export default function MedicalReviewNote({ className = '' }) {
  return (
    <aside className={`rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/[0.10] bg-background/45 text-foreground/52">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.7} />
        </div>
        <div>
          <p className="font-body text-[9px] uppercase tracking-[0.24em] text-foreground/36">
            Medical Review
          </p>
          <p className="mt-2 font-body text-sm leading-relaxed text-foreground/58">
            Reviewed by {MEDICAL_REVIEW.reviewerName}, {MEDICAL_REVIEW.reviewerCredentials}, {MEDICAL_REVIEW.reviewerTitle}. Last reviewed {MEDICAL_REVIEW.reviewedLabel}. This content is general wellness education and does not replace medical advice.
          </p>
          <Link
            to={MEDICAL_REVIEW.policyPath}
            className="mt-3 inline-flex min-h-11 items-center font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/48 transition-colors hover:text-foreground"
          >
            View clinical governance
          </Link>
        </div>
      </div>
    </aside>
  );
}
