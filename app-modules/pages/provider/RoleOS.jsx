import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bell,
  Boxes,
  BriefcaseMedical,
  CheckCircle2,
  Command,
  Grid3X3,
  Radio,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import {
  DISPATCH_MODE,
  FEATURE_STATUS,
  FOUNDER_GROUPS,
  ROLE_OPERATING_SYSTEM,
  countFounderPanels,
  countLiveFeatures,
} from '@/data/roleOperatingSystem';
import { useAuthStore } from '@/lib/useAuthStore';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

const modeIcons = {
  'Service Mode': Stethoscope,
  'Nurse Mode': Activity,
  'Standalone Apps': ScanLine,
  'Clinical Authority': ShieldCheck,
  Dispatch: Radio,
};

const statusTone = {
  [FEATURE_STATUS.live]: 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100',
  [FEATURE_STATUS.staged]: 'border-foreground/12 bg-foreground/[0.035] text-foreground/62',
  [FEATURE_STATUS.next]: 'border-amber-300/28 bg-amber-300/10 text-amber-100',
};

const filters = [
  { id: 'all', label: 'All' },
  { id: 'rn', label: 'RN' },
  { id: 'authority', label: 'NP / MD' },
  { id: 'dispatch', label: 'Ops' },
  { id: 'founder', label: 'Founder' },
];

function normalize(value) {
  return String(value || '').toLowerCase();
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/42">{label}</p>
        <Icon className="h-4 w-4 text-foreground/38" strokeWidth={1.7} />
      </div>
      <p className="mt-4 font-heading text-4xl uppercase leading-none text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 font-body text-[8px] font-semibold uppercase tracking-[0.14em] ${statusTone[status] || statusTone[FEATURE_STATUS.staged]}`}>
      {status}
    </span>
  );
}

function resolveFeatureRoute(feature, userRole = 'provider') {
  const isProvider = normalize(userRole) !== 'admin';
  if (isProvider && feature.route?.startsWith('/admin')) {
    return normalize(feature.label).includes('inventory') ? '/provider/dashboard' : '';
  }
  return feature.route || '';
}

function canShowProviderFeature(feature, userRole = 'provider') {
  if (normalize(userRole) === 'admin') return true;
  return feature.status === FEATURE_STATUS.live && Boolean(resolveFeatureRoute(feature, userRole));
}

function cleanProviderText(value) {
  return String(value || '')
    .replace('Claim and work the live patient queue.', 'Claim and work patient visits.')
    .replace('live timers', 'treatment timers')
    .replace('Live operations, ', 'Operations, ');
}

function FeatureRow({ feature, index, userRole = 'provider', showStatus = true }) {
  const route = resolveFeatureRoute(feature, userRole);
  const description = showStatus ? feature.description : cleanProviderText(feature.description);
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-background/40 font-body text-[10px] text-foreground/52">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground">
            {feature.label}
          </span>
          <span className="mt-1 block font-body text-[11px] leading-relaxed text-foreground/48">
            {description}
          </span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showStatus ? <StatusBadge status={feature.status} /> : null}
        {route ? <ArrowRight className="h-3.5 w-3.5 text-foreground/34" strokeWidth={1.8} /> : null}
      </div>
    </>
  );

  const className = 'flex min-h-[82px] items-center justify-between gap-4 rounded-2xl border border-foreground/10 bg-foreground/[0.028] px-4 py-3 transition-all hover:border-foreground/18 hover:bg-foreground/[0.045]';

  if (route) {
    return <Link to={route} className={className}>{content}</Link>;
  }
  return <div className={className}>{content}</div>;
}

function ModeSection({ group, userRole }) {
  const Icon = modeIcons[group.mode] || Grid3X3;
  const isProvider = normalize(userRole) !== 'admin';
  const liveCount = group.features.filter((item) => item.status === FEATURE_STATUS.live).length;
  const summary = isProvider ? cleanProviderText(group.summary) : group.summary;
  return (
    <motion.section
      initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
      transition={{ duration: 0.48, ease: EASE }}
      className="rounded-[1.4rem] border border-foreground/10 bg-foreground/[0.025] p-4 backdrop-blur-2xl md:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-body text-[9px] uppercase tracking-[0.24em] text-foreground/42">{group.role}</p>
          <h2 className="mt-1 font-heading text-3xl uppercase leading-none tracking-[0.04em] text-foreground">
            {group.mode}
          </h2>
          <p className="mt-2 max-w-2xl font-body text-[12px] leading-relaxed text-foreground/52">{summary}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-foreground/10 bg-background/40 text-foreground/58">
          <Icon className="h-5 w-5" strokeWidth={1.7} />
        </div>
      </div>

      {isProvider ? null : (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-foreground/10 bg-background/38 px-3 py-1 font-body text-[9px] uppercase tracking-[0.14em] text-foreground/48">
            {group.features.length} modules
          </span>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-body text-[9px] uppercase tracking-[0.14em] text-emerald-100">
            {liveCount} live
          </span>
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        {group.features.map((feature, index) => (
          <FeatureRow
            key={`${group.id}-${feature.label}`}
            feature={feature}
            index={index}
            userRole={userRole}
            showStatus={!isProvider}
          />
        ))}
      </div>
    </motion.section>
  );
}

function FounderGroup({ group, userRole }) {
  const live = group.features.filter((item) => item.status === FEATURE_STATUS.live).length;
  return (
    <section className="rounded-[1.4rem] border border-foreground/10 bg-foreground/[0.025] p-4 backdrop-blur-2xl md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-[9px] uppercase tracking-[0.24em] text-foreground/42">Founder</p>
          <h3 className="mt-1 font-heading text-2xl uppercase leading-none tracking-[0.04em] text-foreground">{group.title}</h3>
        </div>
        <span className="rounded-full border border-foreground/10 bg-background/38 px-3 py-1 font-body text-[9px] uppercase tracking-[0.14em] text-foreground/46">
          {live}/{group.features.length} live
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {group.features.map((feature) => {
          const body = (
            <>
              <span>{feature.label}</span>
              <StatusBadge status={feature.status} />
            </>
          );
          const className = 'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.035] px-3.5 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/58 transition-all hover:border-foreground/18 hover:text-foreground';
          const route = normalize(userRole) !== 'admin' && feature.route?.startsWith('/admin') ? '' : feature.route;
          return route
            ? <Link key={`${group.title}-${feature.label}`} to={route} className={className}>{body}</Link>
            : <span key={`${group.title}-${feature.label}`} className={className}>{body}</span>;
        })}
      </div>
    </section>
  );
}

export default function RoleOS() {
  const { user } = useAuthStore();
  const userRole = user?.role || 'provider';
  const isAdmin = normalize(userRole) === 'admin';
  useSeo({
    title: `${isAdmin ? 'Admin Role OS' : 'Provider Tools'} - Avalon Vitality`,
    description: isAdmin
      ? 'Avalon role operating system for provider, clinical authority, dispatch, and founder feature lanes.'
      : 'Avalon provider tools for shift execution, messages, routing, inventory, and clearance.',
    path: isAdmin ? '/admin/role-os' : '/provider/role-os',
    robots: 'noindex, nofollow',
  });
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialFilter = params.get('focus') ? 'rn' : 'all';
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const availableFilters = isAdmin ? filters : filters.filter((filter) => filter.id !== 'founder');
  const selectedFilter = !isAdmin && activeFilter === 'founder' ? 'all' : activeFilter;
  const groups = useMemo(() => ROLE_OPERATING_SYSTEM.filter((group) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'rn') return group.role === 'RN';
    if (selectedFilter === 'authority') return group.id === 'authority';
    if (selectedFilter === 'dispatch') return group.id === 'dispatch';
    return false;
  }).map((group) => ({
    ...group,
    features: isAdmin ? group.features : group.features.filter((feature) => canShowProviderFeature(feature, userRole)),
  })).filter((group) => isAdmin || group.features.length > 0), [isAdmin, selectedFilter, userRole]);
  const founderVisible = isAdmin && (selectedFilter === 'all' || selectedFilter === 'founder');
  const visibleFeatureCount = groups.reduce((total, group) => total + group.features.length, 0) + (founderVisible ? countFounderPanels() : 0);
  const liveFeatureCount = countLiveFeatures(groups) + (founderVisible ? FOUNDER_GROUPS.reduce((total, group) => total + group.features.filter((item) => item.status === FEATURE_STATUS.live).length, 0) : 0);
  const nextCount = groups.reduce((total, group) => total + group.features.filter((item) => item.status === FEATURE_STATUS.next).length, 0);
  const hero = isAdmin
    ? {
        eyebrow: 'Avalon platform',
        title: 'Role OS',
        summary: 'One modular map for RN field execution, NP/MD authority, dispatch operations, and founder command.',
      }
    : {
        eyebrow: normalize(user?.role) === 'provider' ? 'Nurse platform' : 'Avalon platform',
        title: 'Tools',
        summary: 'Open the tools you need for today’s work.',
      };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[1.65rem] border border-foreground/10 bg-foreground/[0.025] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.26)] backdrop-blur-2xl md:p-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/24 to-transparent" />
          <div className="grid gap-6 lg:grid-cols-[1fr_430px] lg:items-end">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/42">
                {hero.eyebrow}
              </p>
              <h1 className="mt-2 font-heading text-5xl uppercase leading-[0.88] tracking-[0.02em] text-foreground md:text-7xl">
                {hero.title}
              </h1>
              <p className="mt-4 max-w-2xl font-body text-sm leading-relaxed text-foreground/55">
                {hero.summary}
              </p>
            </div>
            {isAdmin ? (
              <div className="grid grid-cols-3 gap-2">
                <Stat icon={Grid3X3} label="Modules" value={visibleFeatureCount} />
                <Stat icon={BadgeCheck} label="Live" value={liveFeatureCount} />
                <Stat icon={Sparkles} label="Next" value={nextCount} />
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto rounded-full border border-foreground/10 bg-background/38 p-1">
            {availableFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className="relative inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-full px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] transition-all"
                style={{
                  background: selectedFilter === filter.id ? 'hsl(var(--foreground))' : 'transparent',
                  color: selectedFilter === filter.id ? 'hsl(var(--background))' : 'hsl(var(--foreground) / 0.58)',
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Link to="/provider/shift" className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 transition-all hover:bg-foreground/[0.055]">
            <BriefcaseMedical className="h-5 w-5 text-foreground/52" strokeWidth={1.7} />
            <p className="mt-4 font-body text-[10px] uppercase tracking-[0.18em] text-foreground/42">RN Service</p>
            <p className="mt-1 font-heading text-2xl uppercase text-foreground">Shift</p>
          </Link>
          <Link to="/provider/communications" className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 transition-all hover:bg-foreground/[0.055]">
            <Bell className="h-5 w-5 text-foreground/52" strokeWidth={1.7} />
            <p className="mt-4 font-body text-[10px] uppercase tracking-[0.18em] text-foreground/42">Broadcast</p>
            <p className="mt-1 font-heading text-2xl uppercase text-foreground">Comms</p>
          </Link>
          <Link to="/provider/invoicing" className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 transition-all hover:bg-foreground/[0.055]">
            <ShieldCheck className="h-5 w-5 text-foreground/52" strokeWidth={1.7} />
            <p className="mt-4 font-body text-[10px] uppercase tracking-[0.18em] text-foreground/42">Authority</p>
            <p className="mt-1 font-heading text-2xl uppercase text-foreground">GFE</p>
          </Link>
          <Link to={isAdmin ? '/admin/inventory' : '/provider/dashboard'} className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 transition-all hover:bg-foreground/[0.055]">
            <Boxes className="h-5 w-5 text-foreground/52" strokeWidth={1.7} />
            <p className="mt-4 font-body text-[10px] uppercase tracking-[0.18em] text-foreground/42">Ops</p>
            <p className="mt-1 font-heading text-2xl uppercase text-foreground">Inventory</p>
          </Link>
        </section>

        <AnimatePresence mode="wait">
          {selectedFilter !== 'founder' && (
            <motion.div key={`mode-${selectedFilter}`} className="space-y-4">
              {groups.map((group) => <ModeSection key={group.id} group={group} userRole={userRole} />)}
            </motion.div>
          )}
        </AnimatePresence>

        {founderVisible ? (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/42">Founder view</p>
                <h2 className="mt-1 font-heading text-4xl uppercase leading-none tracking-[0.04em] text-foreground">
                  Full Command Map
                </h2>
              </div>
              <span className="hidden rounded-full border border-foreground/10 bg-foreground/[0.035] px-3 py-1 font-body text-[9px] uppercase tracking-[0.14em] text-foreground/46 sm:inline-flex">
                {countFounderPanels()} panels
              </span>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {FOUNDER_GROUPS.map((group) => <FounderGroup key={group.title} group={group} userRole={userRole} />)}
            </div>
          </section>
        ) : null}

        {selectedFilter === 'dispatch' && isAdmin ? (
          <section className="rounded-[1.4rem] border border-foreground/10 bg-foreground/[0.025] p-5 backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <Command className="h-5 w-5 text-foreground/48" strokeWidth={1.7} />
              <p className="font-body text-[10px] uppercase tracking-[0.22em] text-foreground/42">Dispatch stack</p>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {DISPATCH_MODE.slice(0, 6).map((item) => (
                <FeatureRow key={`dispatch-short-${item.label}`} feature={item} index={0} userRole={userRole} />
              ))}
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="rounded-[1.4rem] border border-foreground/10 bg-foreground/[0.025] p-5 backdrop-blur-2xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-200" strokeWidth={1.7} />
              <div>
                <p className="font-heading text-2xl uppercase leading-none text-foreground">Build rule</p>
                <p className="mt-2 max-w-3xl font-body text-sm leading-relaxed text-foreground/55">
                  Acuity stays responsible for EMR. Qualiphy is GFE fallback only when no Avalon remote NP is on call. Avalon owns the operating layer: ordering, assignment, shift execution, nurse routing, client messaging, local alerts, compliance checkpoints, inventory, payroll proof, and command visibility.
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </AdminLayout>
  );
}
