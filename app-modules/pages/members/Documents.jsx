import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav from './MemberSectionNav.jsx';
import { useSeo } from '@/lib/seo';
import { apiGet, apiPost } from '@/lib/apiClient';

// Strict B/W tokens — same block used in Dashboard.jsx / Account.jsx.
const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const GOOD = 'hsl(140 30% 60%)';
const WARN = 'hsl(38 70% 60%)';
const BAD = 'hsl(0 70% 62%)';

// Default body templates by consent_type. `consent_documents` does not store
// body markdown — only a body_hash — so v1 renders a short, type-appropriate
// reference body. When admins add per-tenant bodies, swap this for the live
// fetch but keep the same shape. Markdown is intentionally minimal:
// blank-line-separated paragraphs, lines beginning `# ` become headings.
const DEFAULT_BODIES = {
  hipaa: `# HIPAA Notice of Privacy Practices

We are required by law to maintain the privacy of your protected health information (PHI) and to provide you with this notice of our legal duties and privacy practices.

# How we use your information

We may use your PHI to coordinate visits, schedule a registered nurse, communicate with your care team, and bill for services. We do not sell your information.

# Your rights

You have the right to inspect and request a copy of your record, ask for amendments, request restrictions on disclosures, and receive an accounting of disclosures. You may file a complaint with us or with the U.S. Department of Health and Human Services without retaliation.

By signing, you acknowledge that you have read this notice and that you understand how Avalon may use and disclose your health information.`,
  telehealth: `# Telehealth Consent

Before a registered nurse delivers any treatment, a licensed provider must evaluate you via video or audio (a "Good-Faith Examination") and either approve or decline your protocol.

# What to expect

The provider may ask questions about your symptoms, medications, and history. The session is brief and is conducted on a secure, encrypted line. The provider may decline treatment if it is not safe.

# Limits of telehealth

Telehealth has limitations versus an in-person exam. If your condition changes or worsens, you agree to call 911 or seek in-person care.

By signing, you consent to a telehealth evaluation as a condition of receiving treatment.`,
  general_treatment: `# General Treatment Consent

You consent to the administration of intravenous (IV) fluids, vitamins, and/or intramuscular injections by a registered nurse, in accordance with orders placed by a licensed provider.

# Risks

Common risks include bruising, soreness at the IV site, lightheadedness, and a brief metallic taste. Less common risks include vein irritation, infiltration, and allergic reaction.

# Alternatives

Alternatives include oral hydration and oral supplementation, which we are happy to discuss.

By signing, you confirm that you have had the opportunity to ask questions and that you consent to treatment.`,
  treatment_specific: `# Treatment-Specific Consent

This consent covers the specific protocol you booked. The risks, benefits, and alternatives for that protocol have been explained to you by your provider during the telehealth evaluation.

By signing, you acknowledge that your questions about this specific protocol have been answered and that you wish to proceed.`,
  privacy: `# Privacy Policy

This describes how Avalon handles your account data — name, email, phone, address, payment method — outside of clinical records. Clinical records are governed by HIPAA and our Notice of Privacy Practices.

We do not sell your data. We use your contact information to schedule visits, send reminders, and provide receipts.`,
  liability: `# Liability & Aftercare Acknowledgement

You acknowledge that any medical procedure carries some risk, that the registered nurse will review aftercare instructions with you, and that you will contact us promptly if you experience side effects.

By signing, you acknowledge the aftercare guidance and the inherent risks of treatment.`,
};

function bodyFor(doc) {
  return DEFAULT_BODIES[doc.consentType] || `# ${doc.title}\n\nThis consent is on file with your care team. Please contact your nurse if you have questions before signing.`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Render the inline markdown body as readable paragraphs and headings — no
// external dep, no risk of XSS (we never set innerHTML).
function renderBody(text) {
  const blocks = String(text || '').split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('# ')) {
      return (
        <h3 key={i} className="mt-5 font-heading text-[15px] uppercase tracking-[0.06em]" style={{ color: TEXT }}>
          {trimmed.slice(2)}
        </h3>
      );
    }
    return (
      <p key={i} className="mt-3 font-body text-[13px] leading-relaxed" style={{ color: 'hsl(var(--foreground) / 0.82)' }}>
        {trimmed}
      </p>
    );
  });
}

function StatusBadge({ status }) {
  const map = {
    pending: { label: 'Required before your next visit', color: WARN, ring: 'hsl(38 70% 60% / 0.30)', bg: 'hsl(38 70% 60% / 0.14)' },
    outdated: { label: 'New version available', color: BAD, ring: 'hsl(0 70% 62% / 0.30)', bg: 'hsl(0 70% 62% / 0.14)' },
    signed: { label: 'Signed', color: GOOD, ring: 'hsl(140 30% 60% / 0.30)', bg: 'hsl(140 30% 60% / 0.14)' },
    historical: { label: 'Archived', color: 'hsl(var(--foreground) / 0.62)', ring: BORDER, bg: CARD_STRONG },
  };
  const m = map[status] || map.historical;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-[9px] font-bold uppercase tracking-[0.16em]"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.ring}` }}
    >
      {status === 'signed' ? <Check className="h-2.5 w-2.5" strokeWidth={2.4} /> : null}
      {m.label}
    </span>
  );
}

function DocCard({ doc, expanded, onToggle, onSign, signingState }) {
  const isPending = doc.status === 'pending' || doc.status === 'outdated';
  const isSigned = doc.status === 'signed';
  const isHistorical = doc.status === 'historical';

  return (
    <article
      className="rounded-[22px] p-5 md:p-6"
      style={{ background: CARD, border: `1px solid ${BORDER}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={doc.status} />
            {doc.version ? (
              <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
                v{doc.version}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 font-heading text-[22px] uppercase leading-tight" style={{ color: TEXT }}>
            {doc.title}
          </h2>
          <p className="mt-2 font-body text-[12px]" style={{ color: MUTED }}>{doc.summary}</p>
          {isSigned && doc.signedAt ? (
            <p className="mt-2 font-body text-[11px]" style={{ color: DIM }}>
              Signed {formatDate(doc.signedAt)}
            </p>
          ) : null}
          {isHistorical && doc.signedAt ? (
            <p className="mt-2 font-body text-[11px]" style={{ color: DIM }}>
              Signed {formatDate(doc.signedAt)} · version no longer active
            </p>
          ) : null}
        </div>
        <div className="shrink-0">
          {isPending ? (
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ background: TEXT, color: INVERT, border: `1px solid ${TEXT}` }}
            >
              {expanded ? 'Close' : 'Open & sign'}
              {expanded
                ? <ChevronDown className="h-3.5 w-3.5 rotate-180 transition-transform" strokeWidth={2} />
                : <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="PDF download coming soon"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-[10px] font-bold uppercase tracking-[0.16em] opacity-50"
              style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}`, cursor: 'not-allowed' }}
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.8} /> PDF · coming soon
            </button>
          )}
        </div>
      </div>

      {/* Inline sign expansion — kept inline (not a modal) for mobile. */}
      {isPending && expanded ? (
        <div className="mt-5 rounded-2xl p-4 md:p-5" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
          <div className="max-h-[42vh] overflow-y-auto pr-1">
            {renderBody(bodyFor(doc))}
          </div>

          <SignForm
            doc={doc}
            state={signingState}
            onSubmit={onSign}
          />
        </div>
      ) : null}
    </article>
  );
}

function SignForm({ doc, state, onSubmit }) {
  const [typedName, setTypedName] = useState('');
  const [agree, setAgree] = useState(false);
  const submitting = state?.status === 'submitting' && state?.documentId === doc.id;
  const error = state?.status === 'error' && state?.documentId === doc.id ? state.message : '';
  const valid = typedName.trim().length >= 3 && agree && !submitting;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({ documentId: doc.id, typedName, agree });
      }}
      className="mt-5"
    >
      <label className="block">
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
          Type your full legal name to sign
        </span>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder="e.g. Mara R. Chen"
          autoComplete="name"
          className="mt-2 w-full rounded-xl px-3 py-2.5 font-body text-sm outline-none focus:ring-2 focus:ring-foreground/40"
          style={{ background: BG, border: `1px solid ${BORDER}`, color: TEXT }}
        />
      </label>
      <label className="mt-4 flex items-start gap-3">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded"
          style={{ accentColor: TEXT }}
        />
        <span className="font-body text-[12px]" style={{ color: TEXT }}>
          I have read and agree to this consent. I understand my typed name is my electronic signature and that the time, IP address, and browser of this signing are recorded.
        </span>
      </label>

      {error ? (
        <p className="mt-3 font-body text-[12px]" style={{ color: BAD }}>{error}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!valid}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-body text-[10px] font-bold uppercase tracking-[0.16em] disabled:opacity-45"
          style={{ background: TEXT, color: INVERT, border: `1px solid ${TEXT}` }}
        >
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
          {submitting ? 'Saving…' : 'Sign and save'}
        </button>
        <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: DIM }}>
          Version {doc.version || '—'}
        </span>
      </div>
    </form>
  );
}

function SectionHeading({ eyebrow, title, count }) {
  return (
    <div className="mt-8 flex items-baseline justify-between gap-3">
      <div>
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>{eyebrow}</p>
        <h2 className="mt-1 font-heading text-2xl uppercase leading-none" style={{ color: TEXT }}>{title}</h2>
      </div>
      <span className="font-body text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: DIM }}>
        {count} {count === 1 ? 'item' : 'items'}
      </span>
    </div>
  );
}

export default function MemberDocuments() {
  useSeo({
    title: 'Documents - Avalon Vitality',
    description: 'Sign and review the consent documents required for your visits.',
    path: '/members/documents',
    robots: 'noindex, nofollow',
  });

  const [load, setLoad] = useState({ status: 'loading', error: '' });
  const [documents, setDocuments] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [signState, setSignState] = useState({ status: 'idle', documentId: null, message: '' });
  const [toast, setToast] = useState('');

  const refresh = async ({ silent = false } = {}) => {
    if (!silent) setLoad({ status: 'loading', error: '' });
    try {
      const res = await apiGet('/api/me/documents');
      setDocuments(Array.isArray(res?.documents) ? res.documents : []);
      setLoad({ status: 'ok', error: '' });
    } catch (err) {
      if (silent) return;
      setLoad({ status: 'error', error: err?.message || 'Could not load documents.' });
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  const groups = useMemo(() => ({
    pending: documents.filter((d) => d.status === 'pending'),
    outdated: documents.filter((d) => d.status === 'outdated'),
    signed: documents.filter((d) => d.status === 'signed'),
    historical: documents.filter((d) => d.status === 'historical'),
  }), [documents]);

  const handleToggle = (id) => setExpandedId((prev) => (prev === id ? null : id));

  const handleSign = async ({ documentId, typedName, agree }) => {
    setSignState({ status: 'submitting', documentId, message: '' });
    try {
      const res = await apiPost('/api/me/documents/sign', { documentId, typedName, agree });
      // Optimistic UI: flip the doc from pending/outdated → signed, collapse expansion.
      setDocuments((prev) => prev.map((d) => {
        if (d.id !== documentId) return d;
        return {
          ...d,
          status: 'signed',
          signedAt: res?.signature?.signedAt || new Date().toISOString(),
          signatureId: res?.signature?.id || d.signatureId,
          pdfUrl: res?.signature?.id ? `/api/me/documents/${res.signature.id}/pdf` : d.pdfUrl,
        };
      }));
      setExpandedId(null);
      setSignState({ status: 'idle', documentId: null, message: '' });
      setToast('Signed. Saved to your record.');
      setTimeout(() => setToast(''), 2600);
      // Background refetch so server is the source of truth.
      refresh({ silent: true });
    } catch (err) {
      setSignState({ status: 'error', documentId, message: err?.message || 'Could not save your signature.' });
    }
  };

  const totalRequired = groups.pending.length + groups.outdated.length;
  const hasAny = documents.length > 0;

  return (
    <main className="min-h-dvh pb-[calc(9rem+env(safe-area-inset-bottom))] font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center"><AvalonMark className="h-[22px] w-[14px] text-foreground" /></Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>Member · Documents</p>
          <Link
            to="/members/dashboard"
            className="font-body text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: MUTED }}
          >
            Done
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pt-5 md:px-6 md:pt-7">
        <MemberSectionNav />
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-6">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>
          Your record
        </p>
        <h1 className="mt-1 font-heading text-5xl uppercase leading-none md:text-6xl">Documents</h1>
        <p className="mt-3 max-w-2xl font-body text-sm" style={{ color: MUTED }}>
          Consent forms required before your next visit, and a record of what you've already signed. Your typed name, the time, and your IP address are all retained as an electronic signature.
        </p>
        {totalRequired > 0 && load.status === 'ok' ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-body text-[11px] font-semibold"
            style={{ background: 'hsl(38 70% 60% / 0.14)', color: WARN, border: `1px solid hsl(38 70% 60% / 0.30)` }}
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={2} />
            {totalRequired} {totalRequired === 1 ? 'document needs' : 'documents need'} your signature
          </p>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 md:px-6">

        {load.status === 'loading' ? (
          <div className="mt-8 rounded-[22px] p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[12px]" style={{ color: MUTED }}>Loading your documents…</p>
          </div>
        ) : null}

        {load.status === 'error' ? (
          <div className="mt-8 rounded-[22px] p-6" style={{ background: CARD, border: `1px solid hsl(0 70% 62% / 0.30)` }}>
            <p className="font-body text-[13px] font-semibold" style={{ color: BAD }}>{load.error}</p>
            <button
              type="button"
              onClick={() => refresh()}
              className="mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
            >
              Try again
            </button>
          </div>
        ) : null}

        {load.status === 'ok' && !hasAny ? (
          <div className="mt-8 rounded-[22px] p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[13px] font-semibold" style={{ color: TEXT }}>No consent documents on file yet.</p>
            <p className="mt-2 font-body text-[12px]" style={{ color: MUTED }}>
              When your provider adds a consent for your next visit, it will show up here.
            </p>
            <Link
              to="/members/messages"
              className="mt-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ background: CARD_STRONG, color: TEXT, border: `1px solid ${BORDER}` }}
            >
              Message your nurse <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        ) : null}

        {load.status === 'ok' && hasAny ? (
          <>
            {groups.pending.length || groups.outdated.length ? (
              <>
                <SectionHeading
                  eyebrow="Action needed"
                  title="To sign"
                  count={groups.pending.length + groups.outdated.length}
                />
                <div className="mt-4 space-y-3">
                  {[...groups.pending, ...groups.outdated].map((doc) => (
                    <DocCard
                      key={doc.id}
                      doc={doc}
                      expanded={expandedId === doc.id}
                      onToggle={() => handleToggle(doc.id)}
                      onSign={handleSign}
                      signingState={signState}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {groups.signed.length ? (
              <>
                <SectionHeading eyebrow="On file" title="Signed" count={groups.signed.length} />
                <div className="mt-4 space-y-3">
                  {groups.signed.map((doc) => (
                    <DocCard
                      key={doc.id}
                      doc={doc}
                      expanded={false}
                      onToggle={() => {}}
                      onSign={handleSign}
                      signingState={signState}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {groups.historical.length ? (
              <>
                <SectionHeading eyebrow="Archived" title="Older versions" count={groups.historical.length} />
                <div className="mt-4 space-y-3">
                  {groups.historical.map((doc) => (
                    <DocCard
                      key={`${doc.id}-${doc.signatureId}`}
                      doc={doc}
                      expanded={false}
                      onToggle={() => {}}
                      onSign={handleSign}
                      signingState={signState}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      {toast ? (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto max-w-3xl px-4 md:bottom-24 md:px-6">
          <p className="rounded-xl px-3 py-2 text-center font-body text-[11px]"
            style={{ background: 'hsl(140 30% 60% / 0.14)', color: GOOD, border: `1px solid hsl(140 30% 60% / 0.30)` }}
          >
            {toast}
          </p>
        </div>
      ) : null}

      <MemberBottomNav />
    </main>
  );
}
