import React, { useEffect, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
const MessagingPanel = lazy(() => import('@/components/messaging/MessagingPanel'));
import { useAuthStore } from '@/lib/useAuthStore';
import {
  Bell, User, Home, Hotel, Building2, Calendar, MapPin,
  FlaskConical, Syringe, Package,
  Phone, MessageSquare, CheckCircle, AlertTriangle, AlertCircle,
  Clock, DollarSign, Users, FileText, ClipboardList, Shield,
  ChevronDown, X, Plus, ArrowLeft, MoreHorizontal,
  Activity, CreditCard, Send, Edit3, Navigation,
  LayoutDashboard, LogOut, RefreshCw,
  Star, TrendingUp, Heart, ChevronRight, Plug,
  Ticket, QrCode, GraduationCap,
  Command as CommandIcon,
} from 'lucide-react';
import { buildAdminRisks } from '@/lib/osRules';
import { readActivity, readLastBooking } from '@/lib/localOs';
import { buildNoApiCompletionSnapshot, buildNoApiReadinessSnapshot, buildNoApiScaleSnapshot } from '@/lib/noApiReadiness';
import {
  buildAvalonKernelSnapshot,
  emitKernelEvent,
  exportKernelAudit,
  KERNEL_BUILD_ITEMS,
} from '@/lib/avalonKernel';
import {
  advanceLatestBooking,
  assignLatestBooking,
  buildLocalLaunchReadiness,
  buildOperatingSpine,
  buildDispatchBoard,
  readAssignmentBroadcasts,
  readGfeRoutingQueue,
  readNurseAlertSettings,
  readOpsMessages,
  readPayrollProofQueue,
  readShiftReplies,
  sendOpsMessage,
  saveNurseAlertSettings,
  acceptExternalPresale,
  buildPresaleSummary,
  generatePresaleCodes,
  readEventPresales,
  saveEventPresale,
} from '@/lib/platformOps';
import { ADMIN_COMMAND_EASE as EASE, TODAY_LABEL, pill } from '@/lib/adminCommandUi.jsx';
import { buildClinicalPlaceholderSnapshot } from '@/data/clinicalPlaceholderPolicy';
import { buildEnterpriseArchitectureSnapshot } from '@/data/enterpriseArchitecture';
import { SEED_ITEMS } from '@/data/inventorySeed';
import { buildEnterpriseSpineSnapshot } from '@/lib/enterpriseSpine';
import { buildNoApiCapabilitySnapshot } from '@/lib/noApiCapabilityGate';
import {
  buildUnifiedOperationalTruth,
  syncLocalRepository,
} from '@/lib/localRepository';
import {
  buildLocalExecutionSnapshot,
  runLocalExecutionSweep,
} from '@/lib/localExecutionEngine';
import {
  buildLocalReliabilitySnapshot,
  runLocalReliabilitySweep,
} from '@/lib/localReliabilityEngine';
import {
  buildLocalScaleSnapshot,
  runLocalScaleSweep,
} from '@/lib/localScaleEngine';
import {
  buildLocalEnterpriseFinishSnapshot,
  runLocalEnterpriseFinishSweep,
} from '@/lib/localEnterpriseFinishEngine';
import {
  buildProductionHealthcareCoreSnapshot,
  runProductionHealthcareCoreSweep,
} from '@/lib/productionHealthcareCore';
import {
  buildPreApiPhaseRoadmapSnapshot,
  runPreApiPhaseRoadmapSweep,
} from '@/lib/preApiPhaseRoadmap';
import { buildPreApiWireReadinessSnapshot } from '@/lib/preApiWireReadiness';
import { buildOperatingDaySnapshot } from '@/lib/operatingDaySimulator';
import { buildDispatchBrainSnapshot } from '@/lib/dispatchBrain';
import { buildSupplyBrainSnapshot } from '@/lib/supplyBrain';
import { buildProviderCompetencySnapshot } from '@/lib/providerCompetencyBrain';
import { buildShiftMarketplaceSnapshot } from '@/lib/shiftMarketplaceBrain';
import { buildArrivalMissionSnapshot } from '@/lib/arrivalMissionBrain';
import { buildVisitCloseoutSnapshot } from '@/lib/visitCloseoutBrain';
import { buildKitReconciliationSnapshot } from '@/lib/kitReconciliationBrain';
import { buildPostVisitQualitySnapshot } from '@/lib/postVisitQualityBrain';
import { isAttioConfigured } from '@/lib/attioPlaceholder';
import {
  GUSTO_PAYROLL_PLACEHOLDER,
  MERCURY_BANKING_PLACEHOLDER,
  QUICKBOOKS_ACCOUNTING_PLACEHOLDER,
  isGustoConfigured,
  isMercuryConfigured,
  isQuickBooksConfigured,
} from '@/lib/financeIntegrations';

// ─── Mock data ────────────────────────────────────────────────────────────────
const REQUESTS = import.meta.env?.DEV ? [
  { id:'r1', client:'Client 001',    phone:'(415) 555-0101', email:'client.001@avalon.local',
    locationType:'hotel',  address:'Hotel location pending',    city:'SF',
    time:'Today 3:00 PM',  therapy:'Recovery Protocol', addons:['Glutathione Push','B12 Shot'],
    total:450, status:'Ready for Visit', source:'Hotel',    priority:'VIP',
    intake:'Done', consent:'Done', gfe:'Cleared',       nurse:'Stephanie R.', payment:'Paid',
    guests:1, notes:'Allergic to latex. Prefers cooler room temp.', created:'9:15 AM' },
  { id:'r2', client:'Client 002',    phone:'(415) 555-0102', email:'client.002@avalon.local',
    locationType:'home',   address:'Client address pending',           city:'SF',
    time:'Today 5:00 PM',  therapy:"Myers Cocktail + NAD+",           addons:['NAD+ (250mg)'],
    total:600, status:'GFE Pending',     source:'Website',  priority:'VIP',
    intake:'Done', consent:'Done', gfe:'Pending',       nurse:'Unassigned',   payment:'Pending',
    guests:1, notes:'Recurring client. Requests Stephanie when available.', created:'8:42 AM' },
  { id:'r3', client:'Client 003',   phone:'(415) 555-0103', email:'client.003@avalon.local',
    locationType:'home',   address:'Client address pending',                    city:'SF',
    time:'Today 6:30 PM',  therapy:'Immunity Drip',                   addons:[],
    total:250, status:'Nurse Assigned',  source:'Referral', priority:null,
    intake:'Done', consent:'Done', gfe:'Cleared',       nurse:'Marcus T.',    payment:'Pending',
    guests:1, notes:'', created:'10:05 AM' },
  { id:'r4', client:'Client 004', phone:'(415) 555-0104', email:'client.004@avalon.local',
    locationType:'office',  address:'Office location pending',         city:'SF',
    time:'Tomorrow 9:00 AM',therapy:'Energy Drip',                    addons:['Extra Fluid'],
    total:825, status:'Confirmed',       source:'Corporate',priority:'Corporate',
    intake:'Done', consent:'Pending', gfe:'Pending',    nurse:'Unassigned',   payment:'Invoice',
    guests:3, notes:'Group of 3. Corporate invoice billing.', created:'Yesterday' },
  { id:'r5', client:'Client 005', phone:'(415) 555-0105', email:'client.005@avalon.local',
    locationType:'home',   address:'Client address pending',           city:'SF',
    time:'Today 4:00 PM',  therapy:'Hydration Boost',                 addons:[],
    total:150, status:'Intake Pending',  source:'Google',   priority:null,
    intake:'Pending', consent:'Pending', gfe:'Not Started', nurse:'Unassigned', payment:'Pending',
    guests:1, notes:'New client. First visit. Nervous about needles.', created:'11:30 AM' },
  { id:'r6', client:'Client 006', phone:'(415) 555-0106', email:'client.006@avalon.local',
    locationType:'office',  address:'Office location pending',                   city:'SF',
    time:'Today 2:00 PM',  therapy:"Myers Cocktail",                   addons:[],
    total:200, status:'Contacted',       source:'Website',  priority:null,
    intake:'Done', consent:'Done', gfe:'Cleared',       nurse:'Unassigned',   payment:'Pending',
    guests:1, notes:'Payment link sent via email.', created:'7:50 AM' },
  { id:'r7', client:'Client 007',  phone:'(415) 555-0107', email:'client.007@avalon.local',
    locationType:'home',   address:'Client address pending',                   city:'SF',
    time:'Tomorrow 11:00 AM',therapy:'Beauty Drip',                   addons:['Glutathione Push','Biotin IM'],
    total:385, status:'New Request',     source:'Instagram', priority:null,
    intake:'Pending', consent:'Pending', gfe:'Not Started', nurse:'Unassigned', payment:'Pending',
    guests:1, notes:'', created:'12:10 PM' },
  { id:'r8', client:'Client 008', phone:'(415) 555-0108', email:'client.008@avalon.local',
    locationType:'home',   address:'Client address pending',               city:'Oakland',
    time:'Today 7:00 PM',  therapy:'Performance Drip + NAD+ IM',      addons:['NAD+ IM'],
    total:330, status:'New Request',     source:'Instagram', priority:null,
    intake:'Pending', consent:'Pending', gfe:'Not Started', nurse:'Unassigned', payment:'Pending',
    guests:2, notes:'Post-game recovery. 2 guests.', created:'1:22 PM' },
] : [];

const NURSES = import.meta.env?.DEV ? [
  { id:'n1', name:'RN 001', status:'Assigned',  area:'SF Downtown / SoMa',          visits:2, kit:'Ready',           phone:'(415) 555-0201', assigned:['Client 001 — 3:00 PM','Client 002 — 5:00 PM'] },
  { id:'n2', name:'RN 002',    status:'Assigned',  area:'Mission / Castro / Noe Valley',visits:1, kit:'Ready',           phone:'(415) 555-0202', assigned:['Client 003 — 6:30 PM'] },
  { id:'n3', name:'Rachel K.',    status:'Available', area:'Marina / Pacific Heights',     visits:0, kit:'Ready',           phone:'(415) 555-0104', assigned:[] },
  { id:'n4', name:'Jordan M.',    status:'Available', area:'Oakland / Berkeley / East Bay', visits:0, kit:'Restock Needed', phone:'(415) 555-0105', assigned:[] },
  { id:'n5', name:'Priya K.',     status:'Off Duty',  area:'South Bay / Peninsula',        visits:0, kit:'Not Set',         phone:'(415) 555-0106', assigned:[] },
] : [];

const CLEARANCE_ITEMS = import.meta.env?.DEV ? [
  { id:'cl1', client:'Client 002',    therapy:"Myers + NAD+",   intake:'Done',    consent:'Done',    gfe:'Pending',     flag:'High dose — MD review required',  status:'GFE Pending' },
  { id:'cl2', client:'Client 005', therapy:'Hydration',      intake:'Pending', consent:'Pending', gfe:'Not Started', flag:null,                               status:'Intake Pending' },
  { id:'cl3', client:'Client 004', therapy:'Energy Drip',    intake:'Done',    consent:'Pending', gfe:'Pending',     flag:'Group booking — 3 guests',         status:'Consent Pending' },
  { id:'cl4', client:'Client 007',  therapy:'Beauty Drip',    intake:'Pending', consent:'Pending', gfe:'Not Started', flag:null,                               status:'Intake Pending' },
] : [];

const PAYMENTS = import.meta.env?.DEV ? [
  { id:'p1', client:'Client 001',    amount:450, status:'Paid',      method:'Card on file',      date:'Today',     invoice:'AV-0041' },
  { id:'p2', client:'Client 002',    amount:600, status:'Pending',   method:'Link not sent',     date:'Today',     invoice:'AV-0042' },
  { id:'p3', client:'Client 003',   amount:250, status:'Link Sent', method:'Stripe deposit',    date:'Today',     invoice:'AV-0043' },
  { id:'p4', client:'Client 004', amount:825, status:'Invoice',   method:'Corporate billing', date:'Net 30',    invoice:'AV-0044' },
  { id:'p5', client:'Client 006', amount:200, status:'Overdue',   method:'Payment pending',     date:'5 days ago',invoice:'AV-0035' },
  { id:'p6', client:'Client 009',   amount:260, status:'Paid',      method:'Card',             date:'May 8',     invoice:'AV-0039' },
] : [];

const FOLLOWUPS = import.meta.env?.DEV ? [
  { id:'f1', client:'Client 001',    visitDate:'Today',  type:'Review Request',     priority:'High', note:'VIP — request review post-visit' },
  { id:'f2', client:'Client 002',    visitDate:'May 8',  type:'Plan',            priority:'High', note:'9 visits - offer Elite' },
  { id:'f3', client:'Client 010',   visitDate:'Mar 18', type:'Rebook Prompt',      priority:'Med',  note:'54 days since last visit — send check-in' },
  { id:'f4', client:'Client 004', visitDate:'May 6',  type:'Post-Visit Check',   priority:'Med',  note:'Corporate client — confirm satisfaction' },
  { id:'f5', client:'Client 006', visitDate:'Open',   type:'Payment Follow-Up',  priority:'High', note:'Invoice AV-0035 overdue 5 days' },
  { id:'f6', client:'Client 007',  visitDate:'Today',  type:'Confirm New Request',priority:'Med',  note:'New request 12:10 PM — no contact yet' },
  { id:'f7', client:'Client 008', visitDate:'Today',  type:'Confirm New Request',priority:'Med',  note:'New request 1:22 PM — no contact yet' },
  { id:'f8', client:'Client 005', visitDate:'Today',  type:'Intake Reminder',    priority:'High', note:'Intake form incomplete — visit Today 4PM' },
  { id:'f9', client:'Client 011',   visitDate:'Feb 12', type:'Rebook Prompt',      priority:'Low',  note:'Quiet since Feb — send check-in' },
] : [];

const MEMBERSHIPS = import.meta.env?.DEV ? [
  { id:'m1', client:'Client 002',    plan:'Elite',    status:'Interested',          sessions:9,  note:'Ready to commit — close this week' },
  { id:'m2', client:'Client 007',  plan:'Revive',   status:'Active Placeholder',  sessions:14, note:'Manual tracking — billing not yet configured' },
  { id:'m3', client:'Client 006', plan:'Recharge', status:'Interested',          sessions:8,  note:'Price-sensitive — offer loyalty discount' },
  { id:'m4', client:'Client 009',   plan:'Revive',   status:'Active Placeholder',  sessions:6,  note:'Manual tracking — billing not yet configured' },
  { id:'m5', client:'New Inquiry',  plan:'Custom',   status:'New',                 sessions:0,  note:'Website form — contacted via Instagram DM' },
] : [];

const EVENTS_LEADS = import.meta.env?.DEV ? [
  { id:'e1', org:'Salesforce Summit',type:'Corporate',contact:'Jennifer H.',date:'Jun 12',  guests:40,    value:'$8,000+',  status:'Proposal Needed' },
  { id:'e2', org:'Hotel Partner 001',  type:'Hotel',    contact:'Partner lead',  date:'Ongoing', guests:'N/A', value:'$2,000/mo',status:'Won' },
  { id:'e3', org:'TechCrunch SF',    type:'Event',    contact:'Lisa Y.',    date:'Jul 18',  guests:100,   value:'$12,000+', status:'Contacted' },
  { id:'e4', org:'Equinox SoMa',     type:'Corporate',contact:'Ryan K.',    date:'Ongoing', guests:20,    value:'$3,500/mo',status:'Follow-Up' },
  { id:'e5', org:'SF Marathon',      type:'Event',    contact:'Dana M.',    date:'Oct 20',  guests:200,   value:'$20,000+', status:'New' },
] : [];

const INVENTORY = import.meta.env?.DEV ? [
  { id:'i1', name:'Nurse Bags',       status:'Ready',          detail:'4 of 4 kitted',  note:'' },
  { id:'i2', name:'IV Bags (1L)',      status:'Low Stock',      detail:'12 remaining',    note:'Reorder from Bound Tree' },
  { id:'i3', name:'NAD+ (250mg)',      status:'Ready',          detail:'8 vials',         note:'' },
  { id:'i4', name:'Glutathione 600mg', status:'Ready',          detail:'14 vials',        note:'' },
  { id:'i5', name:'Vitamin C (50ml)',  status:'Restock Needed', detail:'3 remaining',     note:'Order this week' },
  { id:'i6', name:'B-Complex',         status:'Ready',          detail:'Adequate',        note:'' },
  { id:'i7', name:'CBD (33mg)',         status:'Check Expiry',  detail:'6 vials',         note:'Exp. Jun 2026' },
  { id:'i8', name:'IM Shot Kit',        status:'Ready',         detail:'Stocked',         note:'' },
] : [];

const ACTIVITY = import.meta.env?.DEV ? [
  { id:'a1', text:'Client 001 marked Ready for Visit',       time:'1 min ago',  type:'success' },
  { id:'a2', text:'Payment received · Client 009 · $260',   time:'18 min ago', type:'payment' },
  { id:'a3', text:'RN 002 assigned to Client 003',       time:'34 min ago', type:'nurse'   },
  { id:'a4', text:'New request — Client 008 · Instagram', time:'1h ago',     type:'new'     },
  { id:'a5', text:'Intake received — Client 005',         time:'2h ago',     type:'intake'  },
  { id:'a6', text:'New request — Client 007 · Instagram',  time:'2h ago',     type:'new'     },
  { id:'a7', text:'GFE pending flagged — Client 002',        time:'3h ago',     type:'alert'   },
] : [];

// ─── Primitive components ─────────────────────────────────────────────────────

function StatusPill({ status, small }) {
  const { cls, dot } = pill(status);
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full font-body font-semibold whitespace-nowrap ${small ? 'text-[10px] px-1.5 py-0.5 tracking-[0.08em]' : 'text-[11px] px-2 py-0.5 tracking-[0.1em]'} uppercase ${cls}`}>
      <span className={`w-1 h-1 rounded-full shrink-0 ${dot}`} />
      {status}
    </span>
  );
}

function MicroCheck({ done, label }) {
  return (
    <div className={`flex items-center gap-1 ${done ? 'text-accent' : 'text-foreground/45'}`}>
      {done
        ? <CheckCircle className="w-3 h-3 shrink-0" strokeWidth={2} />
        : <AlertCircle  className="w-3 h-3 shrink-0" strokeWidth={2} />}
      <span className="font-body text-[10px] tracking-[0.08em] uppercase">{label}</span>
    </div>
  );
}

function QuickBtn({ icon: Icon, label, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-body text-[11px] tracking-[0.1em] uppercase font-semibold border transition-all active:scale-95 ${
        accent
          ? 'bg-foreground text-background border-foreground'
          : 'border-foreground/15 text-foreground/70 hover:border-foreground/30'
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />}
      {label}
    </button>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-foreground/[0.14] bg-card/[0.92] shadow-[0_18px_54px_hsl(var(--foreground)/0.07)] backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

function AdminAccordion({ title, eyebrow, icon: Icon, meta, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left md:px-5"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/[0.14] bg-background/[0.72] text-foreground/72">
              <Icon className="h-4 w-4" strokeWidth={1.6} />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="mb-0.5 font-body text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/55">{eyebrow}</p>}
            <p className="truncate font-body text-[12px] font-bold uppercase tracking-[0.22em] text-foreground">
              {title}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta && <span className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/58">{meta}</span>}
          <ChevronDown className={`h-4 w-4 text-foreground/65 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-foreground/[0.10] px-4 py-4 md:px-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="font-body text-[10px] font-semibold tracking-[0.26em] uppercase text-foreground/58 mb-2 px-1">
      {children}
    </p>
  );
}

function LocIcon({ type, className }) {
  const map = { home: Home, hotel: Hotel, office: Building2, event: Calendar };
  const Icon = map[type] || MapPin;
  return <Icon className={className || 'w-4 h-4'} strokeWidth={1.5} />;
}

// ─── Status Tile ──────────────────────────────────────────────────────────────
function StatusTile({ icon: Icon, value, label, sub, urgent }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 transition-colors ${urgent ? 'border-red-500/35 bg-red-500/[0.08]' : 'border-foreground/[0.12] bg-background/[0.62]'}`}>
      <div className={`mb-3 flex items-start justify-between gap-2 ${urgent ? 'text-red-500' : 'text-foreground/65'}`}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        {urgent && <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.8)]" />}
      </div>
      <span className={`block font-heading text-3xl leading-none ${urgent ? 'text-red-500' : 'text-foreground'}`}>{value}</span>
      <span className={`mt-1.5 block font-body text-[9px] font-bold uppercase tracking-[0.16em] ${urgent ? 'text-red-500/85' : 'text-foreground/70'}`}>{label}</span>
      {sub && <span className="mt-1 block truncate font-body text-[10px] text-foreground/56">{sub}</span>}
    </div>
  );
}

// ─── Filter chips ─────────────────────────────────────────────────────────────
function FilterChips({ options, active, onChange }) {
  return (
    <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`shrink-0 px-3.5 py-1.5 rounded-full font-body text-[9px] tracking-[0.15em] uppercase font-semibold border transition-all ${
            active === o
              ? 'bg-foreground text-background border-foreground'
              : 'border-foreground/15 text-foreground/50 hover:border-foreground/30'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ─── Risk Card ────────────────────────────────────────────────────────────────
function RiskCard() {
  const risks = buildAdminRisks(REQUESTS, INVENTORY);
  const critical = risks.filter((risk) => risk.level === 'red').length;
  return (
    <AdminAccordion
      title="Launch Risks"
      eyebrow="Today"
      icon={AlertTriangle}
      meta={`${critical} critical`}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {risks.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-foreground/[0.12] bg-background/[0.58] px-3 py-2.5">
            <span className={`h-2 w-2 shrink-0 rounded-full ${r.level === 'red' ? 'bg-red-400' : 'bg-foreground/30'}`} />
            <div className="min-w-0">
              <p className="truncate font-body text-sm font-semibold text-foreground">{r.label}</p>
              <p className="truncate font-body text-[11px] text-foreground/58">{r.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </AdminAccordion>
  );
}

function CommandPulse() {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-foreground/[0.10]">
        {[
          { label: 'Next visit', value: '2:00 PM', tone: 'text-foreground' },
          { label: 'Blocked', value: '6', tone: 'text-red-500' },
          { label: 'Today rev.', value: '$1.28k', tone: 'text-accent' },
        ].map((item) => (
          <div key={item.label} className="px-4 py-4">
            <p className="font-body text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/56">{item.label}</p>
            <p className={`mt-1.5 font-heading text-3xl leading-none ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
const ACT_COLORS = {
  success: 'bg-accent', payment: 'bg-foreground/30', nurse: 'bg-foreground/30',
  new: 'bg-foreground/30', intake: 'bg-foreground/30', alert: 'bg-red-400',
};

function ActivityFeed() {
  const localActivity = readActivity(5).map((item) => ({
    id: item.id,
    text: item.text,
    time: 'Local',
    type: 'success',
  }));
  const items = [...localActivity, ...ACTIVITY].slice(0, 12);
  return (
    <AdminAccordion title="Activity Feed" icon={Activity} meta={`${items.length} events`}>
      <div className="-mx-4 -my-4 divide-y divide-foreground/[0.05]">
        {items.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ACT_COLORS[a.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs text-foreground/75 leading-snug">{a.text}</p>
              <p className="font-body text-[9px] text-foreground/45 mt-0.5">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </AdminAccordion>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────
function RequestCard({ req, onOpen }) {
  const [open, setOpen] = useState(false);
  const displayStatus = localStorage.getItem(`av.visit.status.${req.id}`) || req.status;
  const blockers = [
    req.intake !== 'Done' && 'Intake',
    req.consent !== 'Done' && 'Consent',
    req.gfe !== 'Cleared' && 'Clearance',
    req.nurse === 'Unassigned' && 'Nurse',
    req.payment !== 'Paid' && 'Payment',
  ].filter(Boolean);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <Card className="overflow-hidden transition-colors active:bg-foreground/[0.06]">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full p-3.5 text-left md:p-4"
          aria-expanded={open}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.08] bg-background/[0.24]">
                <LocIcon type={req.locationType} className="h-4 w-4 text-foreground/45 shrink-0" />
              </span>
              <div className="min-w-0">
                <p className="font-body text-sm font-semibold leading-tight text-foreground">{req.client}</p>
                <p className="font-body text-[10px] text-foreground/40 truncate">{req.address}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {req.priority && (
                <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.15em] text-accent">
                  {req.priority}
                </span>
              )}
              <StatusPill status={displayStatus} small />
              <ChevronDown className={`h-4 w-4 text-foreground/45 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} strokeWidth={1.8} />
            </div>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="border-t border-foreground/[0.06] px-3.5 pb-3.5 pt-3 md:px-4 md:pb-4">
                {/* Visit info */}
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="flex items-center gap-1 text-foreground/50">
                    <Clock className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                    <span className="truncate font-body text-[10px]">{req.time}</span>
                  </div>
                  <div className="flex min-w-0 items-center gap-1 text-foreground/50">
                    <FlaskConical className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                    <span className="truncate font-body text-[10px]">{req.therapy}</span>
                  </div>
                  <div className="flex items-center gap-1 text-foreground/50">
                    <DollarSign className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                    <span className="font-body text-[10px]">${req.total}</span>
                  </div>
                </div>

                {/* Progress row */}
                <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <MicroCheck done={req.intake === 'Done'}   label="Intake"   />
                  <MicroCheck done={req.consent === 'Done'}  label="Consent"  />
                  <MicroCheck done={req.gfe === 'Cleared'}   label="Cleared"  />
                  <MicroCheck done={req.nurse !== 'Unassigned'} label="Nurse" />
                  <MicroCheck done={req.payment === 'Paid'}  label="Paid"     />
                </div>

                {blockers.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {blockers.slice(0, 3).map((b) => (
                      <span key={b} className="rounded-full border border-red-400/20 bg-red-400/[0.08] px-2 py-0.5 font-body text-[8px] font-semibold uppercase tracking-[0.12em] text-red-300">
                        {b}
                      </span>
                    ))}
                    {blockers.length > 3 && (
                      <span className="rounded-full border border-foreground/[0.08] px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] text-foreground/45">
                        +{blockers.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-body text-[9px] text-foreground/45 tracking-[0.1em] uppercase">{req.source}</span>
                    <span className="text-foreground/45">·</span>
                    <span className="font-body text-[9px] text-foreground/45">{req.created}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpen(req)}
                    className="rounded-full border border-foreground/15 px-3 py-1.5 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/70 transition-colors hover:border-foreground/35 hover:text-foreground"
                  >
                    Open Visit
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ─── Visit Detail Sheet ───────────────────────────────────────────────────────
const VISIT_STATUSES = [
  'New Request','Contacted','Confirmed','Intake Pending','Consent Pending',
  'Clearance Pending','GFE Pending','Cleared','Nurse Assigned','Payment Pending','Ready for Visit',
  'En Route','Arrived','In Progress','Completed','Follow-Up Due','Cancelled',
];

function latestBookingToRequest(booking) {
  if (!booking) return null;
  const contact = booking.contact || {};
  const guestCount = Number(booking.guests || 1);
  const status = booking.status === 'Scheduling received' ? 'New Request' : booking.status || 'New Request';
  return {
    id: `latest-${booking.id || booking.reference || 'booking'}`,
    client: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'New client',
    phone: contact.phone || 'Not provided',
    email: contact.email || 'Not provided',
    locationType: booking.locationType || 'home',
    address: booking.address || 'Address pending',
    city: booking.city || booking.zip || 'SF Bay Area',
    time: [booking.date, booking.time].filter(Boolean).join(' ') || 'Time pending',
    therapy: booking.service || 'IV Therapy Session',
    addons: booking.addOns || [],
    addOns: booking.addOns || [],
    total: Number(booking.subtotal || 0),
    status,
    source: booking.source || 'Website',
    priority: booking.gfe === 'Pending' || booking.nurse === 'Unassigned' ? 'High' : 'New',
    intake: booking.intake || 'Pending',
    consent: booking.consent || 'Pending',
    gfe: booking.gfe || 'Pending',
    nurse: booking.nurse || 'Unassigned',
    payment: booking.payment || 'Pending',
    guests: Number.isFinite(guestCount) ? guestCount : 1,
    notes: [
      booking.notes,
      booking.reference ? `Reference: ${booking.reference}` : null,
      booking.nextStep ? `Next: ${booking.nextStep}` : null,
    ].filter(Boolean).join('\n'),
    created: booking.updatedAt ? new Date(booking.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Latest',
  };
}

function VisitDetailSheet({ req, onClose, onUpdate }) {
  const [status, setStatus] = useState(() => localStorage.getItem(`av.visit.status.${req.id}`) || req.status);
  const [nurse, setNurse] = useState(req.nurse || 'Unassigned');
  const [note, setNote] = useState(req.notes || '');
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [transitionError, setTransitionError] = useState('');
  const isLatest = String(req.id).startsWith('latest-');

  const applyStatus = (nextStatus) => {
    setTransitionError('');
    setStatus(nextStatus);
    localStorage.setItem(`av.visit.status.${req.id}`, nextStatus);
    if (isLatest) {
      const result = advanceLatestBooking(nextStatus, {
        gfe: ['Confirmed', 'Cleared', 'Nurse Assigned', 'Ready for Visit', 'En Route', 'Arrived', 'In Progress', 'Completed'].includes(nextStatus) ? 'Cleared' : req.gfe,
        payment: nextStatus === 'Completed' ? 'Paid' : req.payment,
        actor: 'admin',
      });
      if (!result.ok) {
        setStatus(req.status);
        localStorage.setItem(`av.visit.status.${req.id}`, req.status);
        setTransitionError(result.errors.join(' '));
        return;
      }
      if (result.booking) onUpdate?.(latestBookingToRequest(result.booking));
    }
    setStatusOpen(false);
  };

  const applyNurse = (nurseName) => {
    setTransitionError('');
    setNurse(nurseName);
    if (isLatest) {
      const result = assignLatestBooking(nurseName);
      if (!result.ok) {
        setNurse(req.nurse || 'Unassigned');
        setTransitionError(result.errors.join(' '));
        return;
      }
      if (result.booking) onUpdate?.(latestBookingToRequest(result.booking));
    }
    setAssignOpen(false);
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Assign nurse"
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ duration: 0.4, ease: EASE }}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
      style={{ maxHeight: '92vh' }}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10"
        onClick={onClose}
      />

      <div className="relative bg-background border-t border-foreground/[0.1] rounded-t-3xl flex flex-col overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4 border-b border-foreground/[0.06] shrink-0">
          <div>
            <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45 mb-1">Visit Detail</p>
            <h2 className="font-heading text-3xl text-foreground uppercase leading-none">{req.client}</h2>
            <div className="flex items-center gap-2 mt-2">
              <StatusPill status={status} />
              {req.priority && (
                <span className="font-body text-[8px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-accent/40 text-accent">
                  {req.priority}
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/50">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Client info */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Phone', req.phone, Phone],
              ['Email', req.email, FileText],
              ['Location', req.city + ' · ' + req.locationType, MapPin],
              ['Time', req.time, Clock],
              ['Guests', `${req.guests} guest${req.guests > 1 ? 's' : ''}`, Users],
              ['Source', req.source, Star],
            ].map(([label, val, Icon]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3 h-3 text-foreground/45 shrink-0" strokeWidth={1.5} />
                  <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/45">{label}</p>
                </div>
                <p className="font-body text-xs text-foreground/80 truncate">{val}</p>
              </div>
            ))}
          </div>

          {/* Address */}
          <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3">
            <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/45 mb-1">Address</p>
            <p className="font-body text-xs text-foreground/80">{req.address}</p>
          </div>

          {/* Therapy */}
          <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3">
            <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/45 mb-1.5">Therapy</p>
            <p className="font-body text-sm font-semibold text-foreground">{req.therapy}</p>
            {req.addons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {req.addons.map((a) => (
                  <span key={a} className="font-body text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 rounded-full border border-foreground/15 text-foreground/55">
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Clinical status */}
          <div>
            <SectionLabel>Clinical Clearance</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Intake', val: req.intake },
                { label: 'Consent', val: req.consent },
                { label: 'GFE / Clearance', val: req.gfe },
                { label: 'Nurse', val: req.nurse !== 'Unassigned' ? req.nurse : 'Unassigned' },
              ].map(({ label, val }) => {
                const ok = val === 'Done' || val === 'Cleared' || (val !== 'Pending' && val !== 'Unassigned' && val !== 'Not Started');
                return (
                  <div key={label} className={`rounded-xl border px-3 py-2.5 ${ok ? 'border-accent/20 bg-accent/[0.04]' : 'border-foreground/15 bg-foreground/[0.035]'}`}>
                    <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/45 mb-1">{label}</p>
                    <div className={`flex items-center gap-1.5 ${ok ? 'text-accent' : 'text-foreground/60'}`}>
                      {ok ? <CheckCircle className="w-3 h-3 shrink-0" strokeWidth={2} /> : <AlertCircle className="w-3 h-3 shrink-0" strokeWidth={2} />}
                      <p className="font-body text-xs font-medium truncate">{val}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment */}
          <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/45 mb-1">Estimated Total</p>
              <p className="font-heading text-2xl text-foreground">${req.total}</p>
            </div>
            <StatusPill status={req.payment === 'Paid' ? 'Paid' : 'Payment Pending'} />
          </div>

          {/* Status changer */}
          <div>
            <SectionLabel>Update Status</SectionLabel>
            <button
              type="button"
              onClick={() => setStatusOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-foreground/15 text-left"
            >
              <StatusPill status={status} />
              <ChevronDown className={`w-4 h-4 text-foreground/40 transition-transform ${statusOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>
            <AnimatePresence>
              {statusOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 grid grid-cols-2 gap-1.5">
                    {VISIT_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => applyStatus(s)}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-left transition-all ${
                          status === s ? 'border-foreground/30 bg-foreground/[0.06]' : 'border-foreground/[0.06] hover:border-foreground/20'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pill(s).dot}`} />
                        <span className="font-body text-[9px] tracking-[0.08em] uppercase text-foreground/70">{s}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Nurse assignment */}
          <div>
            <SectionLabel>Nurse Assignment</SectionLabel>
            <button
              type="button"
              onClick={() => setAssignOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-foreground/15"
            >
              <div className="flex items-center gap-2">
                <Syringe className="w-4 h-4 text-foreground/40" strokeWidth={1.5} />
                <span className="font-body text-sm text-foreground/70">{nurse}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-foreground/40 transition-transform ${assignOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>
            <AnimatePresence>
              {assignOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 space-y-1.5">
                    {NURSES.filter(n => n.status !== 'Off Duty').map((n) => (
                      <button key={n.id} type="button"
                        onClick={() => applyNurse(n.name)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-foreground/[0.06] hover:border-foreground/20 text-left"
                      >
                        <div>
                          <p className="font-body text-xs font-semibold text-foreground">{n.name}</p>
                          <p className="font-body text-[9px] text-foreground/40">{n.area}</p>
                        </div>
                        <StatusPill status={n.status} small />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notes */}
          {transitionError && (
            <div className="rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3">
              <p className="font-body text-xs leading-relaxed text-red-300">{transitionError}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <SectionLabel>Internal Notes</SectionLabel>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add notes..."
              className="w-full rounded-xl border border-foreground/15 bg-foreground/[0.03] px-4 py-3 font-body text-xs text-foreground placeholder:text-foreground/45 focus:outline-none focus:border-foreground/35 resize-none"
            />
          </div>

          {/* Placeholder notice */}
          <div className="rounded-xl border border-foreground/[0.06] px-4 py-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 shrink-0" />
            <p className="font-body text-[9px] tracking-[0.1em] text-foreground/45 uppercase">
              Local mode
            </p>
          </div>
        </div>

        {/* Action bar */}
        <div className="px-5 pt-3 pb-5 border-t border-foreground/[0.06] space-y-2 shrink-0"
             style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
            <QuickBtn icon={MessageSquare} label="Text Client"   />
            <QuickBtn icon={Syringe}       label="Assign Nurse" onClick={() => setAssignOpen(true)} />
            <QuickBtn icon={Shield}        label="Mark Cleared" onClick={() => applyStatus('Cleared')} />
            <QuickBtn icon={CreditCard}    label="Mark Paid" onClick={() => {
              if (isLatest) {
                const result = advanceLatestBooking(status, { payment: 'Paid', override: true, reason: 'Payment marked ready' });
                if (!result.ok) setTransitionError(result.errors.join(' '));
                if (result.booking) onUpdate?.(latestBookingToRequest(result.booking));
              }
            }} />
            <QuickBtn icon={CheckCircle}   label="Complete" onClick={() => applyStatus('Completed')} accent />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NurseAlertBackendPanel() {
  const [settings, setSettings] = useState(() => readNurseAlertSettings());
  const [broadcasts, setBroadcasts] = useState(() => readAssignmentBroadcasts());
  const [messages, setMessages] = useState(() => readOpsMessages());
  const [draft, setDraft] = useState('');
  const active = broadcasts.filter((item) => item.status !== 'Assigned');
  const dispatchMessages = messages.filter((message) => message.threadId === 'dispatch').slice(0, 5);
  const enabledChannels = Object.entries(settings.channels || {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key.toUpperCase());

  useEffect(() => {
    const onLocalChange = (event) => {
      if (event.detail?.key === 'nurseAlertSettings') setSettings(readNurseAlertSettings());
      if (event.detail?.key === 'assignmentBroadcasts') setBroadcasts(readAssignmentBroadcasts());
      if (event.detail?.key === 'opsMessages') setMessages(readOpsMessages());
    };
    window.addEventListener('av.local.change', onLocalChange);
    window.addEventListener('storage', onLocalChange);
    return () => {
      window.removeEventListener('av.local.change', onLocalChange);
      window.removeEventListener('storage', onLocalChange);
    };
  }, []);

  const toggleEnabled = () => {
    const next = saveNurseAlertSettings({ enabled: !settings.enabled });
    setSettings(next);
  };

  const sendDispatchMessage = () => {
    if (!draft.trim()) return;
    setMessages(sendOpsMessage({
      threadId: 'dispatch',
      audience: settings.recipients || 'On-call nurses',
      from: 'Admin Command',
      role: 'blast',
      status: 'Broadcasting',
      channels: enabledChannels.map((channel) => channel.toLowerCase()),
      text: draft,
    }));
    setDraft('');
  };

  return (
    <AdminAccordion
      title="Nurse Alert System"
      icon={Bell}
      meta={settings.enabled ? `${active.length} active` : 'paused'}
      defaultOpen={active.length > 0}
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            { label: 'Status', value: settings.enabled ? 'Active' : 'Paused' },
            { label: 'Repeats', value: `${settings.repeatMinutes} min` },
            { label: 'Escalates', value: `${settings.escalationAfterMinutes} min` },
            { label: 'Channels', value: enabledChannels.length ? enabledChannels.join(' · ') : 'None' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[8px] uppercase tracking-[0.2em] text-foreground/45">{item.label}</p>
              <p className="mt-1 truncate font-body text-sm font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Current Rule</p>
              <p className="mt-2 font-body text-xs leading-relaxed text-foreground/55">
                Send enabled channel placeholders to {settings.recipients || 'on-call nurses'} until each appointment or subscription date is assigned.
              </p>
              <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/42">
                {settings.escalationNote}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={toggleEnabled}
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-foreground/[0.12] px-3 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/70"
              >
                {settings.enabled ? 'Pause' : 'Resume'}
              </button>
              <Link
                to="/provider/settings?tab=alerts"
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-foreground px-3 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-background"
              >
                Edit <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {active.length ? active.slice(0, 4).map((broadcast) => (
            <div key={broadcast.id} className="rounded-2xl border border-foreground/[0.08] bg-card/[0.58] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold text-foreground">{broadcast.client}</p>
                  <p className="mt-1 truncate font-body text-xs text-foreground/55">{broadcast.service} · {broadcast.date} · {broadcast.time}</p>
                  <p className="mt-1 truncate font-body text-[10px] text-foreground/45">{broadcast.address}</p>
                </div>
                <span className="shrink-0 rounded-full border border-accent/25 bg-accent/[0.07] px-2.5 py-1 font-body text-[8px] uppercase tracking-[0.14em] text-accent">
                  Every {broadcast.repeatsEveryMinutes || settings.repeatMinutes}m
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(broadcast.channels || []).map((channel) => (
                  <span key={channel.key} className="rounded-full border border-foreground/[0.08] bg-background/[0.24] px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] text-foreground/45">
                    {channel.key} · {channel.status}
                  </span>
                ))}
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4 text-center font-body text-xs text-foreground/45">
              No active nurse assignment broadcasts.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Admin Blast</p>
              <p className="mt-1 font-body text-[11px] text-foreground/42">Send one dispatch alert to nurse text, email, and in-app queues.</p>
            </div>
            <MessageSquare className="h-4 w-4 shrink-0 text-foreground/45" strokeWidth={1.6} />
          </div>
          <div className="mt-3 space-y-2">
            {dispatchMessages.map((message) => (
              <div key={message.id} className="rounded-xl border border-foreground/[0.07] bg-background/[0.22] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55">{message.from}</p>
                  <span className="shrink-0 font-body text-[9px] text-foreground/45">
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-1 font-body text-xs leading-relaxed text-foreground/70">{message.text}</p>
                {message.delivery?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.delivery.map((delivery) => (
                      <span key={`${message.id}-${delivery.key}`} className="rounded-full border border-foreground/[0.08] bg-background/[0.24] px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] text-foreground/45">
                        {delivery.label} · {delivery.status}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              aria-label="Broadcast message to on-call nurses"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendDispatchMessage();
              }}
              placeholder="Blast on-call nurses..."
              className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-foreground/[0.1] bg-background/[0.28] px-3 font-body text-xs text-foreground outline-none placeholder:text-foreground/45 focus:border-accent/40"
            />
            <button
              type="button"
              onClick={sendDispatchMessage}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-foreground px-3 text-background"
              aria-label="Send dispatch message"
            >
              <Send className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function OperatingSpinePanel({ requests, latestBooking, onSelectRequest }) {
  const spine = buildOperatingSpine(requests, latestBooking);
  const latestId = latestBooking?.id || latestBooking?.reference;
  return (
    <AdminAccordion title="Operating Spine" icon={Plug} meta={`${spine.stages.length} stages`} defaultOpen>
      <div className="grid gap-2 md:grid-cols-4">
        {spine.stages.map((stage, index) => {
          const hot = stage.count > 0 && ['deposit', 'acuity', 'gfe', 'shift'].includes(stage.key);
          return (
            <div key={stage.key} className="rounded-2xl border p-3" style={{ background: hot ? 'hsl(var(--accent) / 0.07)' : 'hsl(var(--foreground) / 0.035)', borderColor: hot ? 'hsl(var(--accent) / 0.20)' : 'hsl(var(--foreground) / 0.10)' }}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background/40 font-body text-[10px] text-foreground/50">
                  {index + 1}
                </span>
                <span className="font-heading text-3xl leading-none text-foreground">{stage.count}</span>
              </div>
              <p className="mt-3 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">{stage.label}</p>
              <p className="mt-1 font-body text-[9px] uppercase tracking-[0.14em] text-foreground/42">{stage.owner}</p>
              <p className="mt-2 font-body text-[11px] leading-relaxed text-foreground/52">{stage.action}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {spine.items.slice(0, 6).map((item) => {
          const isLatest = latestId && (item.id === latestId || item.id === 'latest-booking');
          const request = requests.find((req) => req.id === item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (request) onSelectRequest(request);
                if (isLatest && latestBooking) onSelectRequest(latestBookingToRequest(latestBooking));
              }}
              className="block w-full text-left"
            >
              <Card className="p-4 transition-all hover:border-accent/25 hover:bg-card/[0.72]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/42">{item.source || 'Website'}</p>
                    <p className="mt-1 truncate font-heading text-2xl uppercase leading-none text-foreground">{item.client}</p>
                    <p className="mt-2 truncate font-body text-sm text-foreground/62">{item.service || item.therapy}</p>
                    <p className="mt-1 truncate font-body text-[11px] text-foreground/42">{item.time || item.created || 'Time pending'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusPill status={item.status} small />
                    <span className="font-body text-[8px] uppercase tracking-[0.14em] text-foreground/45">{item.nurse || 'Unassigned'}</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    ['GFE', item.gfe || 'Pending'],
                    ['Pay', item.payment || 'Pending'],
                    ['RN', item.nurse || 'Unassigned'],
                  ].map(([label, value]) => (
                    <span key={label} className="rounded-full border border-foreground/10 bg-background/30 px-2 py-1 text-center font-body text-[8px] uppercase tracking-[0.12em] text-foreground/48">
                      {label}: {value}
                    </span>
                  ))}
                </div>
              </Card>
            </button>
          );
        })}
      </div>
    </AdminAccordion>
  );
}

function LocalLaunchPanel({ latestBooking }) {
  const [readiness, setReadiness] = useState(() => buildLocalLaunchReadiness({ latestBooking }));
  const [activity, setActivity] = useState(() => readActivity(6));
  const [gfeQueue, setGfeQueue] = useState(() => readGfeRoutingQueue());
  const [payrollQueue, setPayrollQueue] = useState(() => readPayrollProofQueue());
  const [shiftReplies, setShiftReplies] = useState(() => readShiftReplies());

  useEffect(() => {
    const refresh = () => {
      setReadiness(buildLocalLaunchReadiness({ latestBooking: readLastBooking() || latestBooking }));
      setActivity(readActivity(6));
      setGfeQueue(readGfeRoutingQueue());
      setPayrollQueue(readPayrollProofQueue());
      setShiftReplies(readShiftReplies());
    };
    window.addEventListener('av.local.change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('av.local.change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [latestBooking]);

  const groups = [
    ['Client', readiness.client],
    ['Nurse', readiness.nurse],
    ['Admin', readiness.admin],
  ];

  return (
    <AdminAccordion
      title="Local Launch OS"
      icon={CommandIcon}
      meta={`${readiness.summary.ready}/${readiness.summary.total} ready`}
      defaultOpen={readiness.summary.action > 0}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3">
          {groups.map(([label, items]) => (
            <div key={label} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/42">{label}</p>
                <span className="rounded-full border border-foreground/10 bg-background/30 px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] text-foreground/42">
                  {items.filter((item) => !['Action', 'Needed'].includes(item.status)).length}/{items.length}
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-5">
                {items.map((item) => {
                  const hot = ['Action', 'Needed'].includes(item.status);
                  return (
                    <div key={item.key} className="rounded-xl border p-2.5" style={{ background: hot ? 'hsl(var(--accent) / 0.07)' : 'hsl(var(--background) / 0.22)', borderColor: hot ? 'hsl(var(--accent) / 0.22)' : 'hsl(var(--foreground) / 0.08)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.13em] text-foreground">{item.label}</p>
                        <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em]" style={{ color: hot ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.42)' }}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 font-body text-[10px] leading-relaxed text-foreground/45">{item.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['GFE', gfeQueue.length],
              ['Y/N', shiftReplies.length],
              ['Pay', payrollQueue.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3 text-center">
                <p className="font-heading text-3xl leading-none text-foreground">{value}</p>
                <p className="mt-1 font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Integration Placeholders</p>
            <div className="mt-3 grid gap-2">
              {(readiness.placeholders || []).map((item) => (
                <div key={item.key} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.13em] text-foreground/70">{item.label}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">
                      {item.mode}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-body text-[10px] leading-relaxed text-foreground/42">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Local Audit</p>
            <div className="mt-3 space-y-2">
              {activity.length ? activity.map((item) => (
                <div key={item.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] p-2">
                  <p className="font-body text-[11px] leading-relaxed text-foreground/62">{item.text}</p>
                  <p className="mt-1 font-body text-[8px] uppercase tracking-[0.12em] text-foreground/45">
                    {new Date(item.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              )) : (
                <p className="font-body text-xs text-foreground/42">No local audit events yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function AvalonKernelPanel({ latestBooking }) {
  const [snapshot, setSnapshot] = useState(() => buildAvalonKernelSnapshot({
    booking: latestBooking,
    requests: REQUESTS,
    nurses: NURSES,
    role: 'founder',
  }));

  useEffect(() => {
    const refresh = () => {
      setSnapshot(buildAvalonKernelSnapshot({
        booking: readLastBooking() || latestBooking,
        requests: REQUESTS,
        nurses: NURSES,
        role: 'founder',
      }));
    };
    window.addEventListener('av.local.change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('av.local.change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [latestBooking]);

  const exportAudit = () => {
    const audit = exportKernelAudit();
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `avalon-kernel-audit-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    emitKernelEvent('audit.exported', { count: audit.events.length }, 'Founder Command');
    setSnapshot(buildAvalonKernelSnapshot({
      booking: readLastBooking() || latestBooking,
      requests: REQUESTS,
      nurses: NURSES,
      role: 'founder',
    }));
  };

  const firstBatch = KERNEL_BUILD_ITEMS.slice(0, 30);
  const nextBatch = KERNEL_BUILD_ITEMS.slice(30, 60);
  const severe = snapshot.exceptions.filter((item) => ['Critical', 'High'].includes(item.severity));

  return (
    <AdminAccordion
      title="Avalon Kernel"
      icon={CommandIcon}
      meta={`${snapshot.shipped}/60 live`}
      defaultOpen={severe.length > 0}
    >
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              ['Health', `${snapshot.health.score}/100`, snapshot.health.status],
              ['Founder', `${snapshot.founder.score}/100`, snapshot.founder.topMove],
              ['Kit', `${snapshot.kitReadiness.score}/100`, snapshot.kitReadiness.status],
              ['Margin', `$${snapshot.economics.margin}`, `${snapshot.economics.marginPercent}%`],
            ].map(([label, value, detail]) => (
              <div key={label} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.2em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-3xl leading-none text-foreground">{value}</p>
                <p className="mt-1 line-clamp-2 font-body text-[10px] leading-relaxed text-foreground/42">{detail}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">First 60 Builds</p>
                <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/45">
                  Kernel, protocol maps, exceptions, ETA, chart lock, demand, coverage, checkout, comms, fairness, fatigue, inventory, incidents, QA.
                </p>
              </div>
              <button
                type="button"
                onClick={exportAudit}
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl bg-foreground px-3 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-background"
              >
                Export <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {firstBatch.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-2.5 py-2">
                  <span className="truncate font-body text-[10px] uppercase tracking-[0.12em] text-foreground/58">
                    {item.number}. {item.label}
                  </span>
                  <span className="shrink-0 rounded-full border border-accent/20 bg-accent/[0.06] px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] text-accent">
                    Live
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Next 30 Scale Controls</p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {nextBatch.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-2.5 py-2">
                  <span className="truncate font-body text-[10px] uppercase tracking-[0.12em] text-foreground/58">
                    {item.number}. {item.label}
                  </span>
                  <span className="shrink-0 rounded-full border border-accent/20 bg-accent/[0.06] px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] text-accent">
                    Live
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Exception Engine</p>
            <div className="mt-3 space-y-2">
              {snapshot.exceptions.length ? snapshot.exceptions.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl border border-accent/20 bg-accent/[0.055] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/70">{item.label}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.12em] text-accent">{item.severity}</span>
                  </div>
                  <p className="mt-1 font-body text-[10px] leading-relaxed text-foreground/45">{item.action}</p>
                </div>
              )) : (
                <p className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] p-3 font-body text-xs text-foreground/45">No kernel exceptions.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Client Tracker</p>
            <div className="mt-3 grid gap-2">
              {[
                ['Status', snapshot.clientTracker.status],
                ['Next', snapshot.clientTracker.next],
                ['GFE', snapshot.clientTracker.gfe.status],
                ['Refund', snapshot.refund.state],
                ['Group', `${snapshot.groupIntake.completed}/${snapshot.groupIntake.requiredIntakes}`],
                ['QR', snapshot.qr.status],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2 rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <span className="font-body text-[9px] uppercase tracking-[0.16em] text-foreground/45">{label}</span>
                  <span className="truncate font-body text-[11px] font-semibold text-foreground/66">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Scale Controls</p>
            <div className="mt-3 grid gap-2">
              {[
                ['Demand', snapshot.scale.demand.totalLoad],
                ['Coverage', snapshot.scale.serviceArea.status],
                ['Friction', `${snapshot.scale.checkoutFriction.score}/100`],
                ['Deposit', snapshot.scale.depositGate.status],
                ['Comms', `${snapshot.scale.commsTriage.open} open`],
                ['QA', `${snapshot.scale.postVisitQa.score}/100`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2 rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <span className="font-body text-[9px] uppercase tracking-[0.16em] text-foreground/45">{label}</span>
                  <span className="truncate font-body text-[11px] font-semibold text-foreground/66">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function NoApiReadinessPanel({ latestBooking }) {
  const [snapshot, setSnapshot] = useState(() => buildNoApiReadinessSnapshot({
    booking: latestBooking,
    role: 'admin',
  }));

  useEffect(() => {
    const refresh = () => setSnapshot(buildNoApiReadinessSnapshot({
      booking: readLastBooking() || latestBooking,
      role: 'admin',
    }));
    window.addEventListener('av.local.change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('av.local.change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [latestBooking]);

  const weakest = snapshot.nextWithoutApi;

  return (
    <AdminAccordion
      title="No-API Readiness"
      icon={Plug}
      meta={`${snapshot.covered}/${snapshot.total}`}
      defaultOpen={snapshot.score < 85}
    >
      <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Local Build Coverage</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="font-heading text-6xl leading-none text-foreground">{snapshot.score}</p>
                <p className="mt-1 font-body text-[10px] uppercase tracking-[0.18em] text-accent">{snapshot.status}</p>
              </div>
              <p className="max-w-[14rem] text-right font-body text-[11px] leading-relaxed text-foreground/48">
                This is what Avalon OS can truthfully cover before live APIs are connected.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {snapshot.signals.slice(0, 8).map((signal) => (
              <div key={signal.label} className="rounded-2xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.18em] text-foreground/45">{signal.label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{signal.value}</p>
                <p className="mt-1 truncate font-body text-[10px] text-foreground/42">{signal.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">17 Covered Without API</p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {snapshot.controls.map((item) => (
                <div key={item.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.label}</p>
                    <span className="shrink-0 font-body text-[9px] font-semibold text-accent">{item.coverage}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${item.coverage}%` }} />
                  </div>
                  <p className="mt-1 line-clamp-1 font-body text-[9px] text-foreground/45">{item.proof}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Weakest No-API Work</p>
              <div className="mt-3 space-y-2">
                {weakest.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <span className="truncate font-body text-[10px] uppercase tracking-[0.12em] text-foreground/55">{item.label}</span>
                    <span className="font-body text-[9px] text-accent">{item.coverage}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Still Needs APIs</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.cannotCover.slice(0, 5).map((item) => (
                  <p key={item} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.11em] text-foreground/48">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function NoApiScalePanel({ latestBooking }) {
  const [snapshot, setSnapshot] = useState(() => buildNoApiScaleSnapshot({
    booking: latestBooking,
    requests: REQUESTS,
    nurses: NURSES,
    role: 'admin',
  }));

  useEffect(() => {
    const refresh = () => setSnapshot(buildNoApiScaleSnapshot({
      booking: readLastBooking() || latestBooking,
      requests: REQUESTS,
      nurses: NURSES,
      role: 'admin',
    }));
    window.addEventListener('av.local.change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('av.local.change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [latestBooking]);

  return (
    <AdminAccordion
      title="Scale Readiness"
      icon={TrendingUp}
      meta={`${snapshot.covered}/${snapshot.total}`}
      defaultOpen={snapshot.score < 70}
    >
      <div className="grid gap-3 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Billion-Dollar Machine</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="font-heading text-6xl leading-none text-foreground">{snapshot.score}</p>
                <p className="mt-1 font-body text-[10px] uppercase tracking-[0.18em] text-accent">{snapshot.status}</p>
              </div>
              <p className="max-w-[13rem] text-right font-body text-[11px] leading-relaxed text-foreground/48">
                No-API work that makes Avalon tighter before Acuity, payments, SMS, payroll, and verification go live.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-accent/20 bg-accent/[0.045] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-accent">Investor Metrics</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {snapshot.investorMetrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.28] p-3">
                  <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{metric.label}</p>
                  <p className="mt-1 font-heading text-2xl leading-none text-foreground">{metric.value}</p>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{metric.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">17 Scale Controls</p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {snapshot.controls.map((item) => (
                <div key={item.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.label}</p>
                    <span className="shrink-0 font-body text-[9px] font-semibold text-accent">{item.coverage}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${item.coverage}%` }} />
                  </div>
                  <p className="mt-1 line-clamp-1 font-body text-[9px] text-foreground/45">{item.proof}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3 lg:col-span-2">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Operational Signals</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {snapshot.operationalSignals.slice(0, 12).map((signal) => (
                  <div key={signal.label} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] p-3">
                    <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{signal.label}</p>
                    <p className="mt-1 truncate font-heading text-xl leading-none text-foreground">{signal.value}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{signal.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Still API-Bound</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.stillApiBound.map((item) => (
                  <p key={item} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.11em] text-foreground/48">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function NoApiCompletionPanel() {
  const snapshot = buildNoApiCompletionSnapshot();
  const topDomains = snapshot.domains.slice(0, 12);

  return (
    <AdminAccordion
      title="132 Completion Map"
      icon={CommandIcon}
      meta={`${snapshot.total}/${snapshot.expectedTotal}`}
      defaultOpen={false}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">No-API Finish Line</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="font-heading text-6xl leading-none text-foreground">{snapshot.total}</p>
                <p className="mt-1 font-body text-[10px] uppercase tracking-[0.18em] text-accent">12 x 11</p>
              </div>
              <p className="max-w-[13rem] text-right font-body text-[11px] leading-relaxed text-foreground/48">
                Surgical no-API builds before Avalon starts replacing local truth with APIs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              ['Critical', snapshot.critical],
              ['Major', snapshot.major],
              ['Polish', snapshot.polish],
              ['Core', snapshot.phases.core],
              ['Ops', snapshot.phases.ops],
              ['Scale', snapshot.phases.scale],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {topDomains.map((domain) => (
            <div key={domain.id} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/68">{domain.label}</p>
                  <p className="mt-1 line-clamp-2 font-body text-[10px] leading-relaxed text-foreground/40">{domain.mission}</p>
                </div>
                <span className="shrink-0 rounded-full border border-accent/20 bg-accent/[0.07] px-2 py-1 font-body text-[9px] font-semibold text-accent">
                  {domain.total}
                </span>
              </div>
              <div className="mt-3 grid gap-1.5">
                {domain.builds.slice(0, 5).map((build) => (
                  <div key={build.id} className="flex items-center justify-between gap-2 rounded-xl border border-foreground/[0.06] bg-background/[0.20] px-3 py-2">
                    <p className="truncate font-body text-[10px] text-foreground/55">{build.label}</p>
                    <span className="font-body text-[8px] uppercase tracking-[0.12em] text-foreground/45">{build.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminAccordion>
  );
}

function NoApiCapabilityGatePanel() {
  const snapshot = buildNoApiCapabilitySnapshot();
  const metrics = [
    ['Local', snapshot.localBuildable],
    ['Blocked', snapshot.apiBlocked],
    ['Automation', snapshot.localAutomation],
    ['UI', snapshot.localUi],
    ['Placeholder', snapshot.placeholderSafe],
    ['Critical', snapshot.criticalBuildable],
  ];

  return (
    <AdminAccordion
      title="No-API Gate"
      icon={Plug}
      meta={`${snapshot.localBuildable}/${snapshot.total} local`}
      defaultOpen={false}
    >
      <div className="grid gap-3 xl:grid-cols-[0.74fr_1.26fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Operating Rule</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Ship Local
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              {snapshot.rule} Anything external stays a labeled handoff, not fake certainty.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.045] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-red-300">API Wall</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.apiBoundHandoffs.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/58">{item.label}</p>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.localFallback}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Build Now</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.shipNow.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{item.capabilityClass}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.action}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Placeholder Safe</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.placeholderQueue.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.label}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.proof}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Domain Coverage</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {snapshot.byDomain.map((domain) => (
                <div key={domain.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{domain.label}</p>
                    <span className="shrink-0 font-body text-[9px] text-accent">{domain.total}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                    {domain.localAutomation} automation - {domain.localUi} UI - {domain.placeholderSafe} placeholder
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function LocalRepositoryPanel({ requests, nurses, inventory, booking }) {
  const seed = { requests, nurses, inventory, booking };
  const [syncTick, setSyncTick] = useState(0);
  const truth = buildUnifiedOperationalTruth(seed);
  const { repository, sync, roleViews, ledger } = truth;
  const metrics = [
    ['Entities', repository.entityCount],
    ['Contracts', repository.contractCount],
    ['Schemas', repository.schemaCount],
    ['Quarantine', repository.quarantineCount],
    ['Ledger', ledger.eventCount],
    ['Score', `${truth.score}`],
  ];

  useEffect(() => {
    syncLocalRepository(seed, 'Admin Command boot');
    setSyncTick((value) => value + 1);
  }, [booking?.id, requests.length, nurses.length, inventory.length]);

  const sealRepository = () => {
    syncLocalRepository(seed, 'Admin Command');
    setSyncTick((value) => value + 1);
  };

  return (
    <AdminAccordion
      title="Local Repository"
      icon={FileText}
      meta={`${repository.entityCount} entities`}
      defaultOpen={repository.quarantineCount > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.74fr_1.26fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">State Foundation</p>
              <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
                One Local Truth
              </h3>
              <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Bookings, clients, nurses, visits, kits, inventory, messages, audit events, and cross-portal changes normalize against one schema before APIs arrive.
              </p>
            <button
              type="button"
              onClick={sealRepository}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-background transition-transform active:scale-95"
            >
              Sync Local Repo
            </button>
            {syncTick > 0 && (
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-accent">
                Repository sealed locally - {ledger.integrity}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Contract Counts</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {repository.byType.map((item) => (
                <div key={item.type} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/58">{item.type}</p>
                  <p className="mt-1 font-heading text-xl leading-none text-foreground">{item.count}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Schema Registry</p>
            <div className="mt-3 space-y-1.5">
              {repository.schemas.slice(0, 5).map((schema) => (
                <div key={schema.type} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{schema.type}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{schema.owner}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                    {schema.required.length} required - {schema.safeFields.length} safe fields
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Role-Safe Views</p>
              <div className="mt-3 space-y-1.5">
                {roleViews.map((roleView) => (
                  <div key={roleView.role} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{roleView.role}</p>
                      <span className="shrink-0 font-body text-[9px] text-accent">{roleView.visibleCount}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                      {roleView.hiddenCount} hidden - {roleView.redactedFields} redactions - {roleView.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Cross-Portal Sync</p>
              <div className="mt-3 space-y-1.5">
                {sync.channels.map((channel) => (
                  <div key={channel.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{channel.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{channel.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{channel.proof}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Recent Sync Events</p>
              <div className="mt-3 space-y-1.5">
                {sync.events.length ? sync.events.slice(0, 6).map((event) => (
                  <div key={event.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{event.type}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{event.actor} - {event.at}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    No sync events yet
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Quarantine</p>
              <div className="mt-3 space-y-1.5">
                {repository.quarantine.length ? repository.quarantine.slice(0, 6).map((item) => (
                  <div key={`${item.type}-${item.id}`} className="rounded-xl border border-red-400/20 bg-red-400/[0.045] px-3 py-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-red-300">{item.label}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.errors.join(', ')}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    Clean
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function DispatchBrainPanel({ requests, nurses, inventory, booking }) {
  const snapshot = buildDispatchBrainSnapshot({ requests, nurses, inventory, booking });
  const metricRows = [
    ['Requests', snapshot.metrics.requests],
    ['Roster', snapshot.metrics.nurses],
    ['Ready', snapshot.metrics.dispatchable],
    ['Blocked', snapshot.metrics.blocked],
    ['Avg', snapshot.metrics.avgScore],
    ['ETA Risk', snapshot.metrics.etaRisk],
  ];
  const gradeClass = {
    Dispatch: 'border-accent/25 bg-accent/[0.08] text-accent',
    Offer: 'border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-300',
    Hold: 'border-yellow-400/25 bg-yellow-400/[0.08] text-yellow-300',
    Block: 'border-red-400/25 bg-red-400/[0.08] text-red-300',
  };

  return (
    <AdminAccordion
      title="Dispatch Brain"
      icon={MapPin}
      meta={`${snapshot.metrics.dispatchable} ready`}
      defaultOpen={snapshot.metrics.blocked > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.74fr_1.26fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Local Matching</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Route The Best RN
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Scores nurse, zone, kit, protocol, clearance, workload, ETA, and shift value. Clinical truth stays {snapshot.clinicalMode}.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metricRows.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Score Factors</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {snapshot.scoreFactors.map((factor) => (
                <div key={factor.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/58">{factor.label}</p>
                  <p className="mt-1 font-heading text-xl leading-none text-foreground">{factor.weight}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Best Decisions</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.topDecisions.slice(0, 6).map((decision) => (
                <div key={`${decision.requestId}-${decision.nurseId}`} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{decision.client}</p>
                      <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                        {decision.nurseName} - {decision.etaMinutes} min - ${decision.shiftValue || 0}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] ${gradeClass[decision.grade] || gradeClass.Hold}`}>
                        {decision.grade}
                      </span>
                      <span className="font-heading text-xl leading-none text-foreground">{decision.score}</span>
                    </div>
                  </div>
                  <p className="mt-2 truncate font-body text-[9px] uppercase tracking-[0.10em] text-foreground/45">{decision.nextAction}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Blocked Decisions</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.blocked.length ? snapshot.blocked.slice(0, 5).map((decision) => (
                  <div key={`${decision.requestId}-block`} className="rounded-xl border border-red-400/20 bg-red-400/[0.045] px-3 py-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-red-300">{decision.client}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{decision.blockers.join(', ') || decision.nextAction}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    No hard blocks
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Market Coverage</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.marketCoverage.map((zone) => (
                  <div key={zone.zone} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{zone.zone}</p>
                      <span className="shrink-0 font-body text-[9px] text-accent">{zone.bestScore}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                      {zone.dispatchable}/{zone.requests} ready - {zone.blocked} blocked
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Roster Risk</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {snapshot.workload.map((row) => (
                <div key={row.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.nurse}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{row.risk}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                    {row.status} - {row.kit} - {row.visits} visits
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function SupplyBrainPanel({ requests, nurses, inventory, booking }) {
  const snapshot = buildSupplyBrainSnapshot({ requests, nurses, inventory, booking });
  const metricRows = [
    ['Visits', snapshot.metrics.visits],
    ['Ready', snapshot.metrics.readyReservations],
    ['Blocked', snapshot.metrics.blockedReservations],
    ['Stock', snapshot.metrics.stockLines],
    ['Restock', snapshot.metrics.restock],
    ['Score', snapshot.metrics.integrityScore],
  ];
  const toneClass = {
    ready: 'border-accent/20 bg-accent/[0.06] text-accent',
    action: 'border-yellow-400/25 bg-yellow-400/[0.07] text-yellow-300',
    critical: 'border-red-400/25 bg-red-400/[0.07] text-red-300',
  };

  return (
    <AdminAccordion
      title="Supply Brain"
      icon={Package}
      meta={`${snapshot.metrics.integrityScore}/100`}
      defaultOpen={snapshot.metrics.blockedReservations > 0 || snapshot.metrics.highPriorityRestock > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.74fr_1.26fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Supply Ownership</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Every Visit Hits Stock
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Protocol demand, nurse kits, central inventory, cold-chain proof, and restock pressure run locally. Clinical details stay {snapshot.clinicalMode}.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metricRows.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Rules</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.rules.map((rule) => (
                <p key={rule} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.10em] text-foreground/50">
                  {rule}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Visit Reservations</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.reservations.slice(0, 6).map((reservation) => (
                  <div key={reservation.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{reservation.client}</p>
                        <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                          {reservation.protocol} - {reservation.lines.length} lines - {reservation.nurse}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] ${
                        reservation.status === 'Blocked' ? toneClass.critical : reservation.status === 'Watch' ? toneClass.action : toneClass.ready
                      }`}>
                        {reservation.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Central Stock Impact</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.stockLedger.slice(0, 6).map((line) => (
                  <div key={line.itemId} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{line.name}</p>
                      <span className="shrink-0 font-body text-[9px] text-foreground/45">{line.projectedRemaining}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                      demand {line.demand} - {line.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Nurse Kit Missions</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.kitMissions.map((mission) => (
                  <div key={mission.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{mission.nurse}</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] ${mission.status === 'Ready' ? toneClass.ready : toneClass.action}`}>
                        {mission.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{mission.nextAction}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Restock Missions</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.restockMissions.length ? snapshot.restockMissions.slice(0, 6).map((mission) => (
                  <div key={mission.id} className={`rounded-xl border px-3 py-2 ${mission.priority === 'High' ? 'border-red-400/20 bg-red-400/[0.045]' : 'border-foreground/[0.06] bg-background/[0.22]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{mission.name}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{mission.priority}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                      {mission.reason} - reorder {mission.reorderQty}
                    </p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    No restock pressure
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Cold Chain Proof</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {snapshot.coldChain.map((item) => (
                <span key={item.id} className={`rounded-full border px-2.5 py-1.5 font-body text-[9px] uppercase tracking-[0.10em] ${item.risk === 'ready' ? 'border-foreground/[0.07] bg-background/[0.22] text-foreground/48' : 'border-yellow-400/25 bg-yellow-400/[0.07] text-yellow-300'}`}>
                  {item.name}: {item.status}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function ProviderCompetencyPanel({ requests, nurses, booking }) {
  const snapshot = buildProviderCompetencySnapshot({ requests, nurses, booking });
  const metrics = [
    ['Visits', snapshot.metrics.visits],
    ['Nurses', snapshot.metrics.nurses],
    ['Clear', snapshot.metrics.clear],
    ['Review', snapshot.metrics.review],
    ['Blocked', snapshot.metrics.blocked],
    ['Score', snapshot.metrics.avgScore],
  ];
  const statusClass = {
    Clear: 'border-accent/20 bg-accent/[0.06] text-accent',
    Review: 'border-yellow-400/25 bg-yellow-400/[0.07] text-yellow-300',
    Hold: 'border-yellow-400/25 bg-yellow-400/[0.07] text-yellow-300',
    Block: 'border-red-400/25 bg-red-400/[0.07] text-red-300',
  };

  return (
    <AdminAccordion
      title="Provider Brain"
      icon={GraduationCap}
      meta={`${snapshot.metrics.avgScore}/100`}
      defaultOpen={snapshot.metrics.blocked > 0 || snapshot.metrics.modulesUnderPressure > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Provider Readiness</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Only Clear Nurses See Work
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Credential proof, protocol review, kit fit, workload, and scope gates run locally. Acuity remains the chart.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Hard Rules</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.rules.map((rule) => (
                <p key={rule} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.10em] text-foreground/50">
                  {rule}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Protocol Fit</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.rows.slice(0, 6).map((row) => (
                  <div key={row.requestId} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.client}</p>
                        <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                          {row.protocol} - {row.best?.nurseName || 'No nurse'} - {row.best?.score || 0}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] ${statusClass[row.best?.status] || statusClass.Review}`}>
                        {row.best?.status || 'Review'}
                      </span>
                    </div>
                    <p className="mt-2 truncate font-body text-[9px] text-foreground/45">{row.best?.nextAction || 'No eligible match.'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Nurse Readiness</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.nurseRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.nurse}</p>
                      <span className="shrink-0 font-heading text-base text-foreground/70">{row.bestScore}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                      {row.credential} - {row.kit} - {row.bestProtocol}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Module Pressure</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.modulePressure.slice(0, 6).map((module) => (
                  <div key={module.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{module.title}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{module.requiredOffers} offers</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                      {module.due} due - {module.expired} expired
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Hard Stops</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.allScores.filter((score) => score.status === 'Block').slice(0, 6).map((score) => (
                  <div key={score.id} className="rounded-xl border border-red-400/15 bg-red-400/[0.04] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{score.nurseName}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-red-300">{score.protocol}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{score.blockers[0] || score.nextAction}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function ShiftMarketplacePanel({ requests, nurses, inventory, booking }) {
  const snapshot = buildShiftMarketplaceSnapshot({ requests, nurses, inventory, booking });
  const metrics = [
    ['Visits', snapshot.metrics.visits],
    ['Send', snapshot.metrics.sendable],
    ['Accepted', snapshot.metrics.accepted],
    ['Hold', snapshot.metrics.hold],
    ['Avg $', snapshot.metrics.avgShiftValue],
    ['Escalate', snapshot.metrics.escalations],
  ];
  const stageClass = {
    Accepted: 'border-accent/20 bg-accent/[0.06] text-accent',
    Send: 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300',
    Backup: 'border-sky-400/20 bg-sky-400/[0.06] text-sky-300',
    Hold: 'border-yellow-400/25 bg-yellow-400/[0.07] text-yellow-300',
    'Do Not Send': 'border-red-400/25 bg-red-400/[0.06] text-red-300',
  };

  return (
    <AdminAccordion
      title="Shift Marketplace"
      icon={Send}
      meta={`${snapshot.metrics.sendable} send`}
      defaultOpen={snapshot.metrics.escalations > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Offer Layer</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Nurse Accepts. Nurse Sets ETA.
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Open visits become local Y/N shift offers with pay, city, time, acceptance locks, and ETA authority. SMS and payroll stay placeholder handoffs.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Rules</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.rules.map((rule) => (
                <p key={rule} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.10em] text-foreground/50">
                  {rule}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Offer Queue</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.rows.slice(0, 7).map((row) => (
                <div key={row.requestId} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.client}</p>
                      <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                        {row.primary?.nurseName || 'No nurse'} - {row.city} - ${row.primary?.shiftValue || 0}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] ${stageClass[row.primary?.stage] || stageClass.Hold}`}>
                      {row.primary?.stage || 'Hold'}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-body text-[9px] uppercase tracking-[0.10em] text-foreground/45">
                    {row.primary?.confirmation || 'No clean offer.'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Nurse Inbox</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.nurseInbox.map((row) => (
                  <div key={row.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.nurse}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">
                        {row.open} open
                      </span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                      {row.accepted} accepted - {row.backup} backup - {row.topOffer?.replyCommand || 'NONE'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Accepted Locks</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.acceptedLocks.length ? snapshot.acceptedLocks.map((lock) => (
                  <div key={lock.id} className="rounded-xl border border-accent/15 bg-accent/[0.045] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{lock.client}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{lock.etaOwner}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{lock.confirmation}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    No accepted shift locks
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Escalations</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {snapshot.escalations.slice(0, 6).map((item) => (
                <div key={item.id} className={`rounded-xl border px-3 py-2 ${item.severity === 'High' ? 'border-red-400/20 bg-red-400/[0.045]' : 'border-yellow-400/20 bg-yellow-400/[0.045]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.client}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{item.severity}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function ArrivalMissionPanel({ requests, nurses, inventory, booking }) {
  const snapshot = buildArrivalMissionSnapshot({ requests, nurses, inventory, booking });
  const metrics = [
    ['Visits', snapshot.metrics.visits],
    ['Accepted', snapshot.metrics.accepted],
    ['ETA', snapshot.metrics.etaNeeded],
    ['Route', snapshot.metrics.routeReady],
    ['Texts', snapshot.metrics.clientTexts],
    ['Escalate', snapshot.metrics.escalations],
  ];
  const stageClass = {
    Hold: 'border-red-400/25 bg-red-400/[0.06] text-red-300',
    'Await Accept': 'border-yellow-400/25 bg-yellow-400/[0.07] text-yellow-300',
    'ETA Needed': 'border-yellow-400/25 bg-yellow-400/[0.07] text-yellow-300',
    'Route Needs Address': 'border-red-400/25 bg-red-400/[0.06] text-red-300',
    'Client Text Ready': 'border-accent/20 bg-accent/[0.06] text-accent',
  };

  return (
    <AdminAccordion
      title="Arrival Command"
      icon={Navigation}
      meta={`${snapshot.metrics.routeReady} routes`}
      defaultOpen={snapshot.metrics.etaNeeded > 0 || snapshot.metrics.escalations > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Route Layer</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              No ETA. No Client Text.
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Accepted shifts unlock nurse route, map handoff, client ETA copy, arrival actions, and Acuity closeout placeholders.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Rules</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.rules.map((rule) => (
                <p key={rule} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.10em] text-foreground/50">
                  {rule}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Arrival Missions</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.missions.slice(0, 7).map((mission) => (
                <div key={mission.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{mission.client}</p>
                      <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                        {mission.nurseName} - {mission.eta} - {mission.city}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] ${stageClass[mission.stage] || stageClass['Await Accept']}`}>
                      {mission.stage}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-body text-[9px] uppercase tracking-[0.10em] text-foreground/45">{mission.nextAction}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Handoff Channels</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.handoffChannels.map((channel) => (
                  <div key={channel.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{channel.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{channel.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Client Texts</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.clientTexts.length ? snapshot.clientTexts.slice(0, 5).map((mission) => (
                  <div key={`${mission.id}-text`} className="rounded-xl border border-accent/15 bg-accent/[0.045] px-3 py-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{mission.client}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{mission.clientText}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    No ETA text ready
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Escalations</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {snapshot.escalations.slice(0, 6).map((item) => (
                <div key={item.id} className={`rounded-xl border px-3 py-2 ${item.severity === 'High' ? 'border-red-400/20 bg-red-400/[0.045]' : item.severity === 'Action' ? 'border-yellow-400/20 bg-yellow-400/[0.045]' : 'border-foreground/[0.06] bg-background/[0.22]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.client}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{item.severity}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function VisitCloseoutPanel({ requests, nurses, inventory, booking }) {
  const snapshot = buildVisitCloseoutSnapshot({ requests, nurses, inventory, booking });
  const metrics = [
    ['Visits', snapshot.metrics.visits],
    ['Close', snapshot.metrics.closeoutNeeded],
    ['Acuity', snapshot.metrics.acuityEntry],
    ['Deduct', snapshot.metrics.deductionReady],
    ['Payroll', snapshot.metrics.payrollReady],
    ['Incidents', snapshot.metrics.incidents],
  ];
  const stageClass = {
    Waiting: 'border-yellow-400/20 bg-yellow-400/[0.055] text-yellow-300',
    'Closeout Needed': 'border-red-400/25 bg-red-400/[0.06] text-red-300',
    'Acuity Entry': 'border-sky-400/20 bg-sky-400/[0.06] text-sky-300',
    'Incident Review': 'border-red-400/25 bg-red-400/[0.06] text-red-300',
    'Payroll Ready': 'border-accent/20 bg-accent/[0.06] text-accent',
  };

  return (
    <AdminAccordion
      title="Visit Closeout"
      icon={FileText}
      meta={`${snapshot.metrics.deductionReady} deductions`}
      defaultOpen={snapshot.metrics.closeoutNeeded > 0 || snapshot.metrics.incidents > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Closeout Layer</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Close Acuity. Deduct Kit.
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              After service, Avalon locks follow-up, inventory, incidents, and payroll behind Acuity-ready closeout proof.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Rules</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.rules.map((rule) => (
                <p key={rule} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.10em] text-foreground/50">
                  {rule}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Closeout Queue</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.rows.slice(0, 7).map((row) => (
                <div key={row.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.client}</p>
                      <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                        {row.nurse} - {row.service}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] ${stageClass[row.stage] || stageClass.Waiting}`}>
                      {row.stage}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-body text-[9px] uppercase tracking-[0.10em] text-foreground/45">{row.nextAction}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Deduction Proof</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.deductionLedger.slice(0, 6).map((line) => (
                  <div key={line.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{line.name}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">x{line.qty}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{line.client} - {line.status}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Payroll Proof</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.payrollQueue.length ? snapshot.payrollQueue.slice(0, 5).map((proof) => (
                  <div key={proof.id} className="rounded-xl border border-accent/15 bg-accent/[0.045] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{proof.nurse}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{proof.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{proof.client} - ${proof.amount}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    No payroll proof released
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Incidents</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.incidentQueue.length ? snapshot.incidentQueue.map((item) => (
                  <div key={item.id} className="rounded-xl border border-red-400/20 bg-red-400/[0.045] px-3 py-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.client}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.action}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    No event review queue
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Handoffs</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.handoffChannels.map((channel) => (
                  <div key={channel.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{channel.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{channel.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function KitReconciliationPanel({ requests, nurses, inventory, booking }) {
  const snapshot = buildKitReconciliationSnapshot({ requests, nurses, inventory, booking });
  const metrics = [
    ['Score', snapshot.metrics.score],
    ['Queued', snapshot.metrics.queuedDeductions],
    ['Locked', snapshot.metrics.lockedDeductions],
    ['Central', snapshot.metrics.centralRestock],
    ['Kits', snapshot.metrics.kitsHold],
    ['Launch', snapshot.metrics.launchCapacity],
  ];
  const toneClass = {
    ready: 'border-accent/20 bg-accent/[0.06] text-accent',
    action: 'border-yellow-400/25 bg-yellow-400/[0.07] text-yellow-300',
    critical: 'border-red-400/25 bg-red-400/[0.06] text-red-300',
  };
  const orderTone = {
    High: 'border-red-400/20 bg-red-400/[0.045] text-red-300',
    Normal: 'border-yellow-400/20 bg-yellow-400/[0.045] text-yellow-300',
  };

  return (
    <AdminAccordion
      title="Kit Reconciliation"
      icon={Package}
      meta={`${snapshot.metrics.score}/100`}
      defaultOpen={snapshot.metrics.score < 80 || snapshot.metrics.kitsHold > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Stock Control</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Every Visit Moves Stock.
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Closeout deductions project central stock, nurse kit restock, waste proof, cold-chain review, and launch capacity.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className={`rounded-2xl border p-3 ${snapshot.launchReadiness.status === 'Blocked' ? toneClass.critical : snapshot.launchReadiness.status === 'Constrained' ? toneClass.action : toneClass.ready}`}>
            <p className="font-body text-[9px] uppercase tracking-[0.22em] opacity-65">Launch Readiness</p>
            <p className="mt-3 font-heading text-3xl uppercase leading-none text-foreground">{snapshot.launchReadiness.status}</p>
            <p className="mt-2 font-body text-[11px] leading-relaxed text-foreground/52">{snapshot.launchReadiness.nextAction}</p>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Rules</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.rules.map((rule) => (
                <p key={rule} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.10em] text-foreground/50">
                  {rule}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Stock Truth</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {snapshot.stock.slice(0, 8).map((item) => (
                <div key={item.id} className={`rounded-xl border px-3 py-2 ${toneClass[item.risk] || toneClass.action}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.name}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-70">{item.status}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                    {item.startingQty} start - {item.deducted} used - {item.projectedQty} left
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Nurse Kits</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.kits.slice(0, 5).map((kit) => (
                  <div key={kit.id} className={`rounded-xl border px-3 py-2 ${toneClass[kit.risk] || toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{kit.nurse}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-70">{kit.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{kit.nextAction}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Restock Orders</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.orders.slice(0, 6).map((order) => (
                  <div key={order.id} className={`rounded-xl border px-3 py-2 ${orderTone[order.priority] || orderTone.Normal}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{order.name}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-70">{order.scope}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{order.status} x{order.qty} - {order.vendor}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Waste / Cold</p>
              <div className="mt-3 space-y-1.5">
                {[...snapshot.wasteQueue.slice(0, 3), ...snapshot.coldChain.slice(0, 3)].map((item) => (
                  <div key={item.id} className={`rounded-xl border px-3 py-2 ${toneClass[item.risk || (item.priority === 'High' ? 'critical' : 'action')] || toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.name}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-70">{item.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.nextAction || item.reason}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Audit Trail</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.auditTrail.slice(0, 6).map((event) => (
                  <div key={event.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{event.type}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{event.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{event.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function PostVisitQualityPanel({ requests, nurses, inventory, booking }) {
  const snapshot = buildPostVisitQualitySnapshot({ requests, nurses, inventory, booking });
  const metrics = [
    ['QA', snapshot.metrics.avgQa],
    ['Fix', snapshot.metrics.fix],
    ['Issues', snapshot.metrics.issues],
    ['Care', snapshot.metrics.aftercare],
    ['Reviews', snapshot.metrics.reviews],
    ['Plans', snapshot.metrics.memberships],
  ];
  const stageClass = {
    'Closeout Lock': 'border-red-400/25 bg-red-400/[0.06] text-red-300',
    'Service Recovery': 'border-red-400/25 bg-red-400/[0.06] text-red-300',
    'Acuity Entry': 'border-sky-400/20 bg-sky-400/[0.06] text-sky-300',
    'Payment Hold': 'border-yellow-400/25 bg-yellow-400/[0.07] text-yellow-300',
    'Care Review': 'border-yellow-400/25 bg-yellow-400/[0.07] text-yellow-300',
    'Review Ready': 'border-accent/20 bg-accent/[0.06] text-accent',
  };

  return (
    <AdminAccordion
      title="Post-Visit QA"
      icon={Heart}
      meta={`${snapshot.metrics.avgQa}/100`}
      defaultOpen={snapshot.metrics.fix > 0 || snapshot.metrics.issues > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Care Loop</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Care First. Growth Second.
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Clean visits unlock aftercare, review, rebook, and membership. Incidents and low feedback stay in service recovery.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Rules</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.rules.map((rule) => (
                <p key={rule} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.10em] text-foreground/50">
                  {rule}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">QA Queue</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.rows.slice(0, 7).map((row) => (
                <div key={row.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.client}</p>
                      <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                        {row.qaScore}/100 - {row.service}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] ${stageClass[row.stage] || stageClass['Care Review']}`}>
                      {row.stage}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-body text-[9px] uppercase tracking-[0.10em] text-foreground/45">{row.nextAction}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Aftercare</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.aftercareQueue.length ? snapshot.aftercareQueue.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-xl border border-accent/15 bg-accent/[0.045] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.client}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{item.timing}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.type} - {item.owner}</p>
                  </div>
                )) : (
                  <p className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-3 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                    No aftercare released
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Growth Unlocks</p>
              <div className="mt-3 space-y-1.5">
                {[...snapshot.reviewQueue.slice(0, 3), ...snapshot.rebookQueue.slice(0, 3), ...snapshot.membershipQueue.slice(0, 2)].map((item) => (
                  <div key={item.id} className={`rounded-xl border px-3 py-2 ${item.status === 'Ready' ? 'border-accent/15 bg-accent/[0.045]' : 'border-yellow-400/20 bg-yellow-400/[0.045]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{item.client}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{item.type}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Service Recovery</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.issueQueue.slice(0, 5).map((row) => (
                  <div key={`${row.id}-issue`} className="rounded-xl border border-red-400/20 bg-red-400/[0.045] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.client}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-red-300">{row.qaStatus}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.nextAction}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Audit</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.auditTrail.slice(0, 6).map((event) => (
                  <div key={event.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{event.type}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{event.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{event.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function LocalExecutionEnginePanel({ requests, nurses, inventory, booking }) {
  const [sweep, setSweep] = useState(null);
  const snapshot = sweep?.snapshot || buildLocalExecutionSnapshot({ requests, nurses, inventory, booking });
  const toneClass = {
    ready: 'border-accent/20 bg-accent/[0.055] text-accent',
    action: 'border-yellow-400/25 bg-yellow-400/[0.06] text-yellow-300',
    critical: 'border-red-400/25 bg-red-400/[0.06] text-red-300',
  };
  const metrics = [
    ['Active', snapshot.metrics.active],
    ['Ready', snapshot.metrics.dispatchReady],
    ['Blocked', snapshot.metrics.blocked],
    ['GFE', snapshot.metrics.gfeRequired],
    ['Inventory', snapshot.metrics.inventoryBlocked],
    ['Gate', snapshot.gate.score],
  ];

  const runSweep = () => {
    setSweep(runLocalExecutionSweep({
      requests,
      nurses,
      inventory,
      booking,
      actor: 'Admin Command',
    }));
  };

  return (
    <AdminAccordion
      title="Execution Engine"
      icon={CommandIcon}
      meta={`${snapshot.score}/100`}
      defaultOpen={snapshot.gate.status !== 'Launch Ready'}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Phases 4-6</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Local Execution
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Booking state, nurse acceptance, annual GFE, ETA authority, inventory reservation, closeout, and launch gates run locally before APIs arrive.
            </p>
            <button
              type="button"
              onClick={runSweep}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-background transition-transform active:scale-95"
            >
              Run Sweep
            </button>
            {sweep && (
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-accent">
                {sweep.actions.length} local action{sweep.actions.length === 1 ? '' : 's'} queued
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Phase Scores</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.phaseScores.map((phase) => (
                <div key={phase.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{phase.label}</p>
                    <span className="shrink-0 font-body text-[9px] text-accent">{phase.score}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{phase.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Visit Execution</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.visits.slice(0, 7).map((row) => (
                  <div key={row.id} className={`rounded-xl border px-3 py-2 ${toneClass[row.risk] || toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{row.client}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{row.stage}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/42">
                      {row.service} - {row.nurse} - {row.etaAuthority}
                    </p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.nextAction}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Launch Gate</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.gate.gates.map((gate) => (
                  <div key={gate.id} className={`rounded-xl border px-3 py-2 ${gate.clear ? toneClass.ready : toneClass.critical}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{gate.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{gate.clear ? 'Clear' : 'Block'}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{gate.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Inventory Impact</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.inventoryImpact.slice(0, 6).map((item) => (
                  <div key={item.itemId} className={`rounded-xl border px-3 py-2 ${item.blocked ? toneClass.critical : item.projectedRemaining <= 2 ? toneClass.action : toneClass.ready}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{item.name}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{item.demand} {item.unit}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">
                      {item.visits} visit{item.visits === 1 ? '' : 's'} - {item.projectedRemaining} projected
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">API Boundary</p>
              <div className="mt-3 space-y-1.5">
                {[
                  ['Acuity', 'Scheduling and EMR remain source of record.'],
                  ['Qualiphy', 'GFE fallback only if Avalon NP is not on call.'],
                  ['Nurseys', 'Credential verification placeholder.'],
                  ['Mercury/Gusto/QuickBooks', 'Banking, payroll, and accounting stay non-client-facing.'],
                ].map(([label, detail]) => (
                  <div key={label} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{label}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function LocalReliabilityPanel({ requests, nurses, inventory, booking }) {
  const [sweep, setSweep] = useState(null);
  const snapshot = sweep?.snapshot || buildLocalReliabilitySnapshot({ requests, nurses, inventory, booking });
  const toneClass = {
    ready: 'border-accent/20 bg-accent/[0.055] text-accent',
    action: 'border-yellow-400/25 bg-yellow-400/[0.06] text-yellow-300',
    critical: 'border-red-400/25 bg-red-400/[0.06] text-red-300',
  };
  const severityClass = {
    Critical: toneClass.critical,
    High: toneClass.critical,
    Action: toneClass.action,
    Watch: toneClass.ready,
  };
  const metrics = [
    ['Open', snapshot.metrics.exceptions],
    ['Critical', snapshot.metrics.critical],
    ['Comms', `${snapshot.metrics.commsReady}/${snapshot.metrics.commsRoutes}`],
    ['Launch', snapshot.metrics.launchScore],
    ['Routes', snapshot.metrics.routeReady],
    ['Texts', snapshot.metrics.clientTexts],
  ];

  const runSweep = () => {
    setSweep(runLocalReliabilitySweep({
      requests,
      nurses,
      inventory,
      booking,
      actor: 'Admin Command',
    }));
  };

  return (
    <AdminAccordion
      title="Reliability Engine"
      icon={RefreshCw}
      meta={`${snapshot.score}/100`}
      defaultOpen={snapshot.metrics.critical > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Phases 7-9</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Reliability
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Exception command, alert routing, launch simulation, and API boundaries run locally. Nothing sends until integrations exist.
            </p>
            <button
              type="button"
              onClick={runSweep}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-background transition-transform active:scale-95"
            >
              Run Reliability Sweep
            </button>
            {sweep && (
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-accent">
                {sweep.actions.length} local action{sweep.actions.length === 1 ? '' : 's'} queued
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Phase Scores</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.phaseScores.map((phase) => (
                <div key={phase.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{phase.label}</p>
                    <span className="shrink-0 font-body text-[9px] text-accent">{phase.score}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{phase.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Exception Command</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.exceptions.slice(0, 8).map((row) => (
                  <div key={row.id} className={`rounded-xl border px-3 py-2 ${severityClass[row.severity] || toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{row.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{row.severity}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/42">{row.owner} - {row.client}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.action}</p>
                  </div>
                ))}
                {!snapshot.exceptions.length && (
                  <div className={`rounded-xl border px-3 py-2 ${toneClass.ready}`}>
                    <p className="font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">No Open Exceptions</p>
                    <p className="mt-1 font-body text-[9px] text-foreground/45">Local command queue is clean.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Comms Routes</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.comms.routes.map((route) => (
                  <div key={route.id} className={`rounded-xl border px-3 py-2 ${route.ready ? toneClass.ready : toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{route.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{route.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/42">{route.owner} - {route.audience}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{route.trigger}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Launch Simulator</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.launch.gates.map((gate) => (
                  <div key={gate.id} className={`rounded-xl border px-3 py-2 ${gate.clear ? toneClass.ready : toneClass.critical}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{gate.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{gate.clear ? 'Clear' : 'Block'}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{gate.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">API Boundaries</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.apiBoundaries.map((row) => (
                  <div key={row.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{row.mode}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.owns}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function LocalScalePanel({ requests, nurses, inventory, booking }) {
  const [sweep, setSweep] = useState(null);
  const snapshot = sweep?.snapshot || buildLocalScaleSnapshot({ requests, nurses, inventory, booking });
  const toneClass = {
    ready: 'border-accent/20 bg-accent/[0.055] text-accent',
    action: 'border-yellow-400/25 bg-yellow-400/[0.06] text-yellow-300',
    critical: 'border-red-400/25 bg-red-400/[0.06] text-red-300',
  };
  const statusClass = {
    Ready: toneClass.ready,
    Action: toneClass.action,
    Blocked: toneClass.critical,
  };
  const metrics = [
    ['Markets', `${snapshot.metrics.readyMarkets}/${snapshot.metrics.markets}`],
    ['SOPs', `${snapshot.metrics.readySops}/${snapshot.metrics.sops}`],
    ['Release', snapshot.metrics.releaseScore],
    ['Blocks', snapshot.metrics.releaseBlocks],
    ['Builds', snapshot.metrics.totalBuilds],
    ['Score', snapshot.score],
  ];

  const runSweep = () => {
    setSweep(runLocalScaleSweep({
      requests,
      nurses,
      inventory,
      booking,
      actor: 'Admin Command',
    }));
  };

  return (
    <AdminAccordion
      title="Scale Engine"
      icon={TrendingUp}
      meta={`${snapshot.score}/100`}
      defaultOpen={snapshot.release.status !== 'Ready'}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Phases 10-12</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Scale
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Market packets, SOP control, and release gates convert the local platform into a repeatable operator OS.
            </p>
            <button
              type="button"
              onClick={runSweep}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-background transition-transform active:scale-95"
            >
              Run Scale Sweep
            </button>
            {sweep && (
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-accent">
                {sweep.actions.length} local action{sweep.actions.length === 1 ? '' : 's'} queued
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Phase Scores</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.phaseScores.map((phase) => (
                <div key={phase.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{phase.label}</p>
                    <span className="shrink-0 font-body text-[9px] text-accent">{phase.score}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{phase.status}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Market Playbooks</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.market.rows.map((row) => (
                  <div key={row.id} className={`rounded-xl border px-3 py-2 ${statusClass[row.status] || toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{row.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{row.score}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/42">
                      {row.tier} - {row.readyNurses} nurses - {row.demand} demand
                    </p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.nextAction}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">SOP Control</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.sop.rows.map((row) => (
                  <div key={row.id} className={`rounded-xl border px-3 py-2 ${statusClass[row.status] || toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{row.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{row.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/42">{row.owner} - {row.proofHits}/{row.proof.length} proofs</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.proof.join(' - ')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Release Gates</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.release.gates.map((gate) => (
                  <div key={gate.id} className={`rounded-xl border px-3 py-2 ${gate.clear ? toneClass.ready : toneClass.critical}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{gate.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{gate.clear ? 'Clear' : 'Hold'}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{gate.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Release Types</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.release.releases.map((release) => (
                  <div key={release.id} className={`rounded-xl border px-3 py-2 ${release.status === 'Allowed' ? toneClass.ready : toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{release.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{release.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">Owner: {release.owner}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-foreground/[0.06] bg-background/[0.22] p-3">
                <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/45">Owner Load</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {snapshot.sop.ownerLoad.map((row) => (
                    <span key={row.owner} className="rounded-full border border-foreground/[0.07] bg-background/[0.22] px-2.5 py-1.5 font-body text-[9px] text-foreground/48">
                      {row.owner}: {row.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function LocalEnterpriseFinishPanel({ requests, nurses, inventory, booking }) {
  const [sweep, setSweep] = useState(null);
  const snapshot = sweep?.snapshot || buildLocalEnterpriseFinishSnapshot({ requests, nurses, inventory, booking });
  const toneClass = {
    ready: 'border-accent/20 bg-accent/[0.055] text-accent',
    action: 'border-yellow-400/25 bg-yellow-400/[0.06] text-yellow-300',
    critical: 'border-red-400/25 bg-red-400/[0.06] text-red-300',
  };
  const statusClass = {
    Ready: toneClass.ready,
    Action: toneClass.action,
    Blocked: toneClass.critical,
    Clear: toneClass.ready,
    Hold: toneClass.critical,
  };
  const metrics = [
    ['Phases', `${snapshot.metrics.readyPhases}/${snapshot.metrics.phases}`],
    ['QA', snapshot.metrics.qaScore],
    ['Access', snapshot.metrics.accessScore],
    ['Package', snapshot.metrics.packagingScore],
    ['License', snapshot.metrics.licensingScore],
    ['Search', snapshot.metrics.searchItems],
  ];

  const runSweep = () => {
    setSweep(runLocalEnterpriseFinishSweep({
      requests,
      nurses,
      inventory,
      booking,
      actor: 'Admin Command',
    }));
  };

  return (
    <AdminAccordion
      title="Enterprise Finish"
      icon={Shield}
      meta={`${snapshot.score}/100`}
      defaultOpen={snapshot.status !== 'Ready'}
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Phases 13-24</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Finish
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              QA command, access safety, protocol packaging, finance ledger, retention, licensing, and white-label readiness.
            </p>
            <button
              type="button"
              onClick={runSweep}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-background transition-transform active:scale-95"
            >
              Run Finish Sweep
            </button>
            {sweep && (
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-accent">
                {sweep.actions.length} local action{sweep.actions.length === 1 ? '' : 's'} queued
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Last 12 Phases</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.phaseScores.map((phase) => (
                <div key={phase.id} className={`rounded-xl border px-3 py-2 ${statusClass[phase.status] || toneClass.action}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{phase.label}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{phase.score}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{phase.goal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">QA Command</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.qa.rows.map((row) => (
                  <div key={row.id} className={`rounded-xl border px-3 py-2 ${row.clear ? toneClass.ready : toneClass.critical}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{row.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{row.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/42">{row.owner} - {row.command}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Access Safety</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.access.roles.map((row) => (
                  <div key={row.role} className={`rounded-xl border px-3 py-2 ${statusClass[row.status] || toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{row.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{row.score}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.safetyRule}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Protocol + Finance</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.packaging.protocolRows.map((row) => (
                  <div key={row.id} className={`rounded-xl border px-3 py-2 ${statusClass[row.readiness] || toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{row.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{row.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/42">{row.category} - {row.inventoryClass}</p>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.clearance}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-foreground/[0.06] bg-background/[0.22] p-3">
                <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/45">Finance Ledger</p>
                <p className="mt-2 font-heading text-2xl uppercase leading-none text-foreground">
                  ${snapshot.packaging.financeLedger.gross}
                </p>
                <p className="mt-1 font-body text-[9px] uppercase tracking-[0.12em] text-foreground/45">
                  {snapshot.packaging.financeLedger.deposits} deposit states - admin only
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Retention + Licensing</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.licensing.retentionLoops.map((row) => (
                  <div key={row.id} className={`rounded-xl border px-3 py-2 ${row.clear ? toneClass.ready : toneClass.action}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{row.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] opacity-80">{row.clear ? 'Clear' : 'Hold'}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/42">{row.owner} - {row.trigger}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {snapshot.licensing.licensingRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{row.replaceable ? 'Modular' : 'Core'}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.boundary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function ProductionHealthcareCorePanel() {
  const [sweep, setSweep] = useState(null);
  const snapshot = sweep?.snapshot || buildProductionHealthcareCoreSnapshot();
  const metrics = [
    ['Closed', snapshot.preApiClosed ? 'Yes' : 'No'],
    ['Closure', snapshot.preApiClosureScore],
    ['Open', snapshot.openPreApiGaps.length],
    ['Big 5', snapshot.bigFiveScore],
    ['Domains', snapshot.domainCount],
    ['API Walls', snapshot.apiResiduals.length],
  ];
  const runSweep = () => {
    setSweep(runProductionHealthcareCoreSweep('Admin Command'));
  };

  return (
    <AdminAccordion
      title="Production Core"
      icon={Shield}
      meta={`${snapshot.preApiClosureScore}/1000`}
      defaultOpen
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.045] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-red-300">Pre-API Healthcare OS</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Closed
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Pre-API gaps are closed as local controls. Runtime gaps below are API residuals only: Auth, Acuity, Stripe, Qualiphy, Nursys, SMS, Mercury, Gusto, and QuickBooks.
            </p>
            <button
              type="button"
              onClick={runSweep}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-background transition-transform active:scale-95"
            >
              Sweep Core
            </button>
            {sweep && (
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-accent">
                {sweep.actions.length} API/runtime gaps queued
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Big 5 Real Gaps</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.bigFive.map((gap) => (
                <div key={gap.id} className="rounded-xl border border-accent/15 bg-accent/[0.035] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{gap.label}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{gap.noApiScore}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/42">{gap.question}</p>
                  <p className="mt-1 line-clamp-1 font-body text-[9px] text-foreground/45">{gap.remainingRisk}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">API Residuals</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.apiResiduals.slice(0, 6).map((residual) => (
                <div key={residual.id} className="rounded-xl border border-yellow-400/20 bg-yellow-400/[0.045] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{residual.label}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-yellow-300">API</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{residual.residual}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">15 Critical Domains</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {snapshot.domains.map((domain) => (
                <div key={domain.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{domain.label}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{domain.preApiClosureCoverage}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{domain.closure?.proof || domain.shipped.slice(0, 3).join(' - ')}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Table Groups</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.tableGroups.map((group) => (
                  <div key={group.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{group.label}</p>
                      <span className="shrink-0 font-body text-[9px] text-accent">{group.tables.length}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{group.tables.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">RLS Families</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.rlsFamilies.map((row) => (
                  <div key={row.id} className="rounded-xl border border-accent/15 bg-accent/[0.045] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{row.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{row.status}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.proof}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function PreApiWireReadinessPanel() {
  const snapshot = buildPreApiWireReadinessSnapshot();
  const metrics = [
    ['Score', `${snapshot.score}/100`],
    ['Vendors', snapshot.integrations.count],
    ['Failures', snapshot.failures.count],
    ['Roles', snapshot.roles.count],
    ['States', snapshot.states.complete ? 'Pass' : 'Hold'],
    ['Open', snapshot.open.length],
  ];

  return (
    <AdminAccordion
      title="Wire Readiness"
      icon={Plug}
      meta={snapshot.status}
      defaultOpen
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.045] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-accent">Tomorrow API Wiring</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              {snapshot.status}
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Contracts, state guards, failure cases, role redactions, and UI truth labels are locally provable before Acuity, Stripe, Supabase, Resend/SMS, Attio, Nursys, Qualiphy, Mercury, Gusto, and QuickBooks go live.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">API-Only Residue</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.apiOnlyResidue.slice(0, 6).map((item) => (
                <p key={item} className="rounded-xl border border-yellow-400/20 bg-yellow-400/[0.04] px-3 py-2 font-body text-[10px] uppercase tracking-[0.10em] text-foreground/54">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Integration Contracts</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {snapshot.integrations.integrations.map((contract) => (
                <div key={contract.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/70">{contract.label}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{contract.complete ? 'Ready' : 'Hold'}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{contract.role}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Failure Matrix</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.failures.cases.slice(0, 7).map((item) => (
                  <div key={item.caseType} className="rounded-xl border border-red-400/15 bg-red-400/[0.035] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/70">{item.caseType.replaceAll('_', ' ')}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-red-300">{item.ownerRole}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.trigger}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Role Proof</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.roles.rows.map((row) => (
                  <div key={row.role} className="rounded-xl border border-accent/15 bg-accent/[0.035] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/70">{row.role}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{row.complete ? 'Pass' : 'Hold'}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">See {row.maySee.length} - redact {row.mustRedact.length}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function OperatingDaySimulatorPanel() {
  const snapshot = buildOperatingDaySnapshot();
  const metrics = [
    ['Score', `${snapshot.score}/1000`],
    ['Visits', snapshot.metrics.requests],
    ['Done', snapshot.metrics.completed],
    ['Revenue', `$${snapshot.metrics.revenueRepresented.toLocaleString()}`],
    ['Deductions', snapshot.metrics.inventoryDeductions],
    ['Open', snapshot.openLocalGaps.length],
  ];

  return (
    <AdminAccordion
      title="Operating Day"
      icon={Activity}
      meta={snapshot.status}
      defaultOpen
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.045] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-accent">Full Local Day</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              {snapshot.status}
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              A complete Avalon operating day runs locally: demand, GFE, dispatch, nurse Y/N, ETA, route, field execution, closeout, inventory, finance, CRM, support, and reconciliation. No vendor is pretending to be live.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Day Timeline</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.timeline.slice(0, 8).map((item) => (
                <div key={`${item.time}-${item.label}`} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/70">{item.label}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{item.time}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 font-body text-[9px] text-foreground/45">{item.proof}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Pass Criteria</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {snapshot.criteria.map((item) => (
                <div key={item.id} className={`rounded-xl border px-3 py-2 ${item.pass ? 'border-accent/15 bg-accent/[0.035]' : 'border-red-400/20 bg-red-400/[0.04]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/70">{item.label}</p>
                    <span className={`shrink-0 font-body text-[8px] uppercase tracking-[0.10em] ${item.pass ? 'text-accent' : 'text-red-300'}`}>{item.pass ? 'Pass' : 'Hold'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Handoffs</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.handoffs.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/70">{item.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">{item.status}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 font-body text-[9px] text-foreground/45">{item.proof}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Failure Proof</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.failureProof.slice(0, 6).map((item) => (
                  <div key={item.caseType} className="rounded-xl border border-red-400/15 bg-red-400/[0.035] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/70">{item.caseType.replaceAll('_', ' ')}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-red-300">{item.simulationStatus}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{item.recoveryOwner}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function PreApiPhaseRoadmapPanel({ requests, nurses, inventory, booking }) {
  const seed = { requests, nurses, inventory, booking };
  const [sweep, setSweep] = useState(null);
  const snapshot = sweep?.snapshot || buildPreApiPhaseRoadmapSnapshot(seed);
  const metrics = [
    ['Closed', snapshot.preApiClosed ? 'Yes' : 'No'],
    ['Closure', snapshot.closureScore],
    ['Open', snapshot.openPreApiGaps.length],
    ['Builds', snapshot.noApiBuilds],
    ['Prod', snapshot.productionClosureScore],
    ['API Walls', snapshot.apiResiduals.length],
  ];
  const runSweep = () => {
    setSweep(runPreApiPhaseRoadmapSweep(seed, 'Admin Command'));
  };

  return (
    <AdminAccordion
      title="24 Phase Map"
      icon={CommandIcon}
      meta={`${snapshot.shipped}/${snapshot.phaseCount}`}
      defaultOpen
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.045] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-accent">Pre-API Build System</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Closed
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              All 24 no-API phases have local closure proof. Live operating scores move only when real visits, inventory, providers, and vendor events exist.
            </p>
            <button
              type="button"
              onClick={runSweep}
              className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-background transition-transform active:scale-95"
            >
              Sweep 24 Phases
            </button>
            {sweep && (
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.12em] text-accent">
                {sweep.actions.length} open pre-API gaps queued
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Closure Proof</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.phases.slice(0, 6).map((phase) => (
                <div key={phase.id} className="rounded-xl border border-accent/15 bg-accent/[0.04] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72">{phase.id} - {phase.label}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{phase.closureScore}</span>
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{phase.closureProof.slice(0, 3).join(' - ')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Phase Groups</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.groups.map((group) => (
                <div key={group.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] p-3">
                  <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{group.label}</p>
                  <span className="shrink-0 font-body text-[9px] text-accent">{group.shipped}/{group.count}</span>
                </div>
                  <p className="mt-1 font-heading text-2xl leading-none text-foreground">{group.closureScore}</p>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{group.preApiStatus}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">All 24 Phases</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {snapshot.phases.map((phase) => (
                <div key={phase.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{phase.id} - {phase.label}</p>
                    <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{phase.shipped ? 'Shipped' : 'Hold'}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, phase.closureScore || 0))}%` }} />
                  </div>
                  <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{phase.preApiStatus} - {phase.goal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function EnterpriseArchitecturePanel() {
  const snapshot = buildEnterpriseArchitectureSnapshot();

  return (
    <AdminAccordion
      title="Enterprise OS"
      icon={Building2}
      meta={`${snapshot.serviceCount} services`}
      defaultOpen
    >
      <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Platform Goal</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Mobile Medical OS
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              {snapshot.goal}. {snapshot.architectureMode}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              ['Services', snapshot.serviceCount],
              ['Modeled', snapshot.modeled],
              ['Events', snapshot.eventCount],
              ['Readiness', `${snapshot.averageReadiness}`],
              ['Sides', snapshot.sides.length],
              ['Contracts', snapshot.contractOnly],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-accent/20 bg-accent/[0.045] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-accent">Non-Negotiables</p>
            <div className="mt-3 space-y-1.5">
              {snapshot.nonNegotiables.map((item) => (
                <p key={item} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.10em] text-foreground/52">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 lg:grid-cols-3">
            {snapshot.sides.map((side) => (
              <div key={side.id} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
                <p className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/68">{side.label}</p>
                <p className="mt-2 line-clamp-3 font-body text-[10px] leading-relaxed text-foreground/42">{side.standard}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {side.owns.slice(0, 3).map((item) => (
                    <span key={item} className="rounded-full border border-foreground/[0.07] bg-background/[0.20] px-2 py-1 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Domain Services</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {snapshot.services.map((service) => (
                <div key={service.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{service.label}</p>
                    <span className="font-body text-[9px] font-semibold text-accent">{service.readiness}</span>
                  </div>
                  <p className="mt-1 line-clamp-1 font-body text-[9px] text-foreground/45">{service.boundary}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 font-body text-[8px] uppercase tracking-[0.10em] text-foreground/45">
                    <span>{service.ownedSurface}</span>
                    <span>{service.eventCount} events</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Event Spine</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {snapshot.eventSpine.map((eventName) => (
                <span key={eventName} className="rounded-full border border-foreground/[0.07] bg-background/[0.22] px-2.5 py-1.5 font-body text-[9px] text-foreground/48">
                  {eventName}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

function ClinicalPlaceholderBoundaryPanel() {
  const snapshot = buildClinicalPlaceholderSnapshot();

  return (
    <AdminAccordion
      title="Clinical Boundary"
      icon={Shield}
      meta={snapshot.mode}
      defaultOpen={false}
    >
      <div className="grid gap-3 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
          <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Clinical Placeholder Policy</p>
          <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
            Placeholder Only
          </h3>
          <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
            {snapshot.reason}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ['Allowed', snapshot.allowedCount],
              ['Blocked', snapshot.blockedCount],
              ['Handoff', snapshot.handoffCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['Allowed', snapshot.allowed],
            ['Blocked', snapshot.blocked],
            ['Handoff', snapshot.handoff],
          ].map(([label, items]) => (
            <div key={label} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">{label}</p>
              <div className="mt-3 space-y-1.5">
                {items.map((item) => (
                  <p key={item} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] leading-snug text-foreground/50">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminAccordion>
  );
}

function EnterpriseSpinePanel({ requests, nurses, inventory, booking }) {
  const snapshot = buildEnterpriseSpineSnapshot({ requests, nurses, inventory, booking });
  const metrics = [
    ['Contracts', snapshot.metrics.contracts],
    ['Actions', snapshot.metrics.actions],
    ['Dispatch', snapshot.metrics.dispatchRows],
    ['Score', snapshot.metrics.topDispatchScore],
    ['Ledger', snapshot.metrics.ledgerLines],
    ['Shortages', snapshot.metrics.shortages],
  ];
  const topMatches = snapshot.dispatchMatrix.slice(0, 5);
  const ledgerLines = snapshot.inventoryLedger.transactions.slice(0, 6);
  const bringList = snapshot.missionPacket.bringList.slice(0, 6);

  return (
    <AdminAccordion
      title="Enterprise Spine"
      icon={CommandIcon}
      meta={`${snapshot.metrics.actions} actions`}
      defaultOpen={snapshot.metrics.actions > 0}
    >
      <div className="grid gap-3 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-4">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">No-API Control Plane</p>
            <h3 className="mt-3 font-heading text-4xl uppercase leading-none tracking-[0.03em] text-foreground">
              Spine Online
            </h3>
            <p className="mt-3 font-body text-[12px] leading-relaxed text-foreground/52">
              Contracts, dispatch scoring, inventory impact, and mission packets run locally. Clinical data stays placeholder-only.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-foreground/[0.07] bg-background/[0.24] p-3">
                <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                <p className="mt-1 font-heading text-2xl leading-none text-foreground">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-accent/20 bg-accent/[0.045] p-3">
            <p className="font-body text-[9px] uppercase tracking-[0.22em] text-accent">Mission Packet</p>
            <p className="mt-2 font-heading text-2xl uppercase leading-none text-foreground">{snapshot.missionPacket.client}</p>
            <p className="mt-2 font-body text-[11px] leading-relaxed text-foreground/48">
              {snapshot.missionPacket.route.etaRule}
            </p>
            <div className="mt-3 grid gap-1.5">
              {[
                snapshot.missionPacket.appointment,
                snapshot.missionPacket.route.maps,
                snapshot.missionPacket.contact.textRule,
              ].map((item) => (
                <p key={item} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2 font-body text-[10px] uppercase tracking-[0.10em] text-foreground/50">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Action Queue</p>
              <div className="mt-3 space-y-1.5">
                {snapshot.actionQueue.slice(0, 7).map((action) => (
                  <div key={action.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{action.label}</p>
                      <span className="shrink-0 font-body text-[8px] uppercase tracking-[0.10em] text-accent">{action.severity}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{action.owner} - {action.nextStep}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Dispatch Matches</p>
              <div className="mt-3 space-y-1.5">
                {topMatches.map((row) => (
                  <div key={row.request.id} className="rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/62">{row.request.client}</p>
                      <span className="shrink-0 font-heading text-xl leading-none text-foreground">{row.best?.score || 0}</span>
                    </div>
                    <p className="mt-1 truncate font-body text-[9px] text-foreground/45">{row.best?.nurseName || 'No nurse'} - {row.best?.status || 'No match'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Inventory Ledger</p>
              <div className="mt-3 space-y-1.5">
                {ledgerLines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/[0.06] bg-background/[0.22] px-3 py-2">
                    <p className="min-w-0 truncate font-body text-[10px] text-foreground/55">{line.client} - {line.item}</p>
                    <span className="shrink-0 font-body text-[9px] uppercase tracking-[0.12em] text-foreground/45">x{line.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-3">
              <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Bring List</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {bringList.map((item) => (
                  <span key={item} className="rounded-full border border-foreground/[0.07] bg-background/[0.22] px-2.5 py-1.5 font-body text-[9px] text-foreground/48">
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-foreground/[0.06] bg-background/[0.22] p-3">
                <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/45">Closeout</p>
                <div className="mt-2 space-y-1.5">
                  {snapshot.missionPacket.closeoutSteps.map((step) => (
                    <p key={step} className="font-body text-[10px] leading-relaxed text-foreground/50">{step}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminAccordion>
  );
}

// ─── Command Screen ───────────────────────────────────────────────────────────
function CommandScreen({ onSelectRequest }) {
  const lastBooking = readLastBooking();
  const latestRequest = latestBookingToRequest(lastBooking);
  const dispatchBoard = buildDispatchBoard(REQUESTS, INVENTORY, lastBooking);
  const attioConfigured = isAttioConfigured();
  const tiles = [
    { icon: Plus,          value: '8',    label: 'New',       sub: '2 same-day',      urgent: false },
    { icon: Shield,        value: '4',    label: 'Clearance', sub: '1 flagged',       urgent: true  },
    { icon: DollarSign,    value: '$660', label: 'Payments',  sub: '1 overdue',       urgent: true  },
    { icon: Calendar,      value: '3',    label: 'Today',     sub: 'in 6h window',    urgent: false },
    { icon: Clock,         value: '5',    label: 'Confirm',   sub: 'awaiting reply',  urgent: false },
    { icon: Users,         value: '4',    label: 'Nurses',    sub: '2 assigned',      urgent: false },
    { icon: AlertCircle,   value: '9',    label: 'Follow-Up', sub: '3 high priority', urgent: false },
    { icon: TrendingUp,    value:'$1.28k',label: 'Revenue',   sub: '3 completed',     urgent: false },
  ];

  const urgent = REQUESTS.filter(r => ['GFE Pending','Intake Pending','New Request'].includes(r.status));

  return (
    <div className="space-y-4 pb-6">
      <CommandPulse />

      <OperatingDaySimulatorPanel />

      <PreApiPhaseRoadmapPanel requests={REQUESTS} nurses={NURSES} inventory={SEED_ITEMS} booking={latestRequest} />

      <ProductionHealthcareCorePanel />

      <PreApiWireReadinessPanel />

      <EnterpriseArchitecturePanel />

      <ClinicalPlaceholderBoundaryPanel />

      <EnterpriseSpinePanel requests={REQUESTS} nurses={NURSES} inventory={INVENTORY} booking={latestRequest} />

      <LocalRepositoryPanel requests={REQUESTS} nurses={NURSES} inventory={INVENTORY} booking={latestRequest} />

      <LocalExecutionEnginePanel requests={REQUESTS} nurses={NURSES} inventory={SEED_ITEMS} booking={latestRequest} />

      <LocalReliabilityPanel requests={REQUESTS} nurses={NURSES} inventory={SEED_ITEMS} booking={latestRequest} />

      <LocalScalePanel requests={REQUESTS} nurses={NURSES} inventory={SEED_ITEMS} booking={latestRequest} />

      <LocalEnterpriseFinishPanel requests={REQUESTS} nurses={NURSES} inventory={SEED_ITEMS} booking={latestRequest} />

      <DispatchBrainPanel requests={REQUESTS} nurses={NURSES} inventory={INVENTORY} booking={latestRequest} />

      <SupplyBrainPanel requests={REQUESTS} nurses={NURSES} inventory={SEED_ITEMS} booking={latestRequest} />

      <ProviderCompetencyPanel requests={REQUESTS} nurses={NURSES} booking={latestRequest} />

      <ShiftMarketplacePanel requests={REQUESTS} nurses={NURSES} inventory={INVENTORY} booking={latestRequest} />

      <ArrivalMissionPanel requests={REQUESTS} nurses={NURSES} inventory={INVENTORY} booking={latestRequest} />

      <VisitCloseoutPanel requests={REQUESTS} nurses={NURSES} inventory={SEED_ITEMS} booking={latestRequest} />

      <KitReconciliationPanel requests={REQUESTS} nurses={NURSES} inventory={SEED_ITEMS} booking={latestRequest} />

      <PostVisitQualityPanel requests={REQUESTS} nurses={NURSES} inventory={SEED_ITEMS} booking={latestRequest} />

      <OperatingSpinePanel requests={REQUESTS} latestBooking={lastBooking} onSelectRequest={onSelectRequest} />

      <AvalonKernelPanel latestBooking={lastBooking} />

      <NoApiReadinessPanel latestBooking={lastBooking} />

      <NoApiScalePanel latestBooking={lastBooking} />

      <NoApiCapabilityGatePanel />

      <NoApiCompletionPanel />

      <LocalLaunchPanel latestBooking={lastBooking} />

      {/* Metrics strip */}
      <AdminAccordion title="Metrics" icon={LayoutDashboard} meta="4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t, index) => (
            <div key={t.label} className={index > 3 ? 'hidden sm:block' : ''}>
              <StatusTile {...t} />
            </div>
          ))}
        </div>
      </AdminAccordion>

      {/* Risk card */}
      <RiskCard />

      <AdminAccordion title="Dispatch" icon={Calendar} meta={`${dispatchBoard.length}`}>
        <div className="grid gap-2 sm:grid-cols-2">
          {dispatchBoard.map((lane) => (
            <button
              key={lane.id}
              type="button"
              onClick={() => {
                if (lane.id === 'latest-booking' && latestRequest) onSelectRequest(latestRequest);
              }}
              className={`block w-full text-left ${lane.id === 'latest-booking' ? '' : 'cursor-default'}`}
            >
              <Card className={`p-4 transition-all ${lane.id === 'latest-booking' ? 'hover:border-accent/25 hover:bg-card/[0.72]' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-[10px] font-semibold uppercase tracking-[0.20em] text-foreground/58">{lane.label}</p>
                  <p className="mt-2 font-body text-base leading-snug text-foreground">{lane.detail}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 font-body text-[8px] uppercase tracking-[0.16em] ${PRIORITY_COLOR[lane.priority] || PRIORITY_COLOR.Low}`}>
                  {lane.status}
                </span>
              </div>
              </Card>
            </button>
          ))}
        </div>
      </AdminAccordion>

      <NurseAlertBackendPanel />

      {/* Needs action now */}
      <AdminAccordion title="Needs Action" icon={AlertCircle} meta={`${urgent.length}`} defaultOpen>
        <div className="space-y-2.5">
          {latestRequest && (
            <button
              type="button"
              onClick={() => onSelectRequest(latestRequest)}
              className="block w-full text-left"
            >
              <Card className="p-4 transition-all hover:border-accent/25 hover:bg-card/[0.72]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-[9px] tracking-[0.22em] uppercase text-accent">Latest</p>
                  <p className="mt-2 font-heading text-2xl uppercase leading-none text-foreground">{lastBooking.service}</p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-foreground/64">
                    {[lastBooking.date, lastBooking.time].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.18em] text-accent">
                  {lastBooking.status || 'New'}
                </span>
              </div>
              </Card>
            </button>
          )}
          {urgent.slice(0, 3).map((r) => (
            <RequestCard key={r.id} req={r} onOpen={onSelectRequest} />
          ))}
        </div>
      </AdminAccordion>

      {/* Activity feed */}
      <ActivityFeed />

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.10] bg-foreground/[0.05]">
            <Users className="h-4 w-4 text-foreground/55" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-body text-[10px] uppercase tracking-[0.26em] text-foreground/62">
                CRM Sync
              </p>
              <span className={`rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.14em] ${
                attioConfigured
                  ? 'border-accent/25 bg-accent/[0.06] text-accent'
                  : 'border-foreground/15 bg-foreground/[0.04] text-foreground/55'
              }`}>
                {attioConfigured ? 'Frontend Env Detected' : 'Server Env Required'}
              </span>
            </div>
            <p className="mt-2 font-body text-[11px] leading-relaxed text-foreground/50">Leads, plans, and follow-ups.</p>
          </div>
        </div>
      </Card>

    </div>
  );
}

// ─── Requests Screen ──────────────────────────────────────────────────────────
const REQ_FILTERS = ['All','New','Confirm','Clearance','Assign','Payment','Ready','Completed'];
const REQ_FILTER_MAP = {
  All:       () => true,
  New:       r => r.status === 'New Request',
  Confirm:   r => ['Contacted','Confirmed'].includes(r.status),
  Clearance: r => ['Intake Pending','Consent Pending','GFE Pending'].includes(r.status),
  Assign:    r => r.nurse === 'Unassigned',
  Payment:   r => r.payment === 'Pending',
  Ready:     r => r.status === 'Ready for Visit',
  Completed: r => r.status === 'Completed',
};

function RequestsScreen({ onSelectRequest }) {
  const [filter, setFilter] = useState('All');
  const filtered = REQUESTS.filter(REQ_FILTER_MAP[filter] || (() => true));
  return (
    <div className="space-y-4 pb-6">
      <div>
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45 mb-3 px-1">
          Request Queue · {REQUESTS.length} total
        </p>
        <FilterChips options={REQ_FILTERS} active={filter} onChange={setFilter} />
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-body text-sm text-foreground/45">No requests in this filter</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((r) => (
            <RequestCard key={r.id} req={r} onOpen={onSelectRequest} />
          ))}
        </div>
      )}
      <button
        type="button"
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-foreground/20 text-foreground/40 hover:text-foreground/60 transition-colors"
      >
        <Plus className="w-4 h-4" strokeWidth={2} />
        <span className="font-body text-xs tracking-[0.15em] uppercase">New Request</span>
      </button>
    </div>
  );
}

// ─── Nurse Card ───────────────────────────────────────────────────────────────
function NurseCard({ nurse }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full text-left">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-foreground/50" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-body text-sm font-semibold text-foreground">{nurse.name}</p>
              <p className="font-body text-[9px] text-foreground/40 truncate max-w-[180px]">{nurse.area}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusPill status={nurse.status} small />
            <ChevronDown className={`w-4 h-4 text-foreground/45 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
          </div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-foreground/[0.06] space-y-3">
              <div className="grid grid-cols-3 gap-2 pt-3">
                <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-2.5 text-center">
                  <p className="font-heading text-xl text-foreground">{nurse.visits}</p>
                  <p className="font-body text-[8px] text-foreground/45 tracking-[0.15em] uppercase">Visits</p>
                </div>
                <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-2.5 text-center col-span-2">
                  <p className="font-body text-[9px] text-foreground/55">{nurse.kit}</p>
                  <p className="font-body text-[8px] text-foreground/45 tracking-[0.15em] uppercase mt-0.5">Kit Status</p>
                </div>
              </div>
              {nurse.assigned.length > 0 && (
                <div>
                  <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/45 mb-1.5">Assigned Today</p>
                  {nurse.assigned.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5">
                      <span className="w-1 h-1 rounded-full bg-foreground/30 shrink-0" />
                      <span className="font-body text-xs text-foreground/65">{a}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <QuickBtn icon={Phone}   label="Call" />
                <QuickBtn icon={MessageSquare} label="Text" />
                <QuickBtn icon={Syringe} label="Assign Visit" accent />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Nurses Screen ────────────────────────────────────────────────────────────
function NursesScreen() {
  const grouped = {
    Available: NURSES.filter(n => n.status === 'Available'),
    Assigned:  NURSES.filter(n => n.status === 'Assigned'),
    'Off Duty':NURSES.filter(n => n.status === 'Off Duty'),
  };
  return (
    <div className="space-y-5 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45 px-1">
        Nurse Assignment Board · {NURSES.length} registered
      </p>
      {Object.entries(grouped).map(([group, nurses]) => nurses.length > 0 && (
        <div key={group}>
          <SectionLabel>{group} ({nurses.length})</SectionLabel>
          <div className="space-y-2.5">
            {nurses.map(n => <NurseCard key={n.id} nurse={n} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Clearance Screen ─────────────────────────────────────────────────────────
function ClearanceScreen() {
  const [filter, setFilter] = useState('All');
  const filters = ['All','Intake Pending','Consent Pending','GFE Pending','Cleared'];
  const items = filter === 'All' ? CLEARANCE_ITEMS : CLEARANCE_ITEMS.filter(c => c.status === filter);

  return (
    <div className="space-y-4 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45 mb-3 px-1">
        Clinical Clearance Queue · {CLEARANCE_ITEMS.length} pending
      </p>
      <FilterChips options={filters} active={filter} onChange={setFilter} />
      <div className="space-y-2.5">
        {items.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="font-body text-sm font-semibold text-foreground">{c.client}</p>
                <p className="font-body text-xs text-foreground/45 mt-0.5">{c.therapy}</p>
              </div>
              <StatusPill status={c.status} small />
            </div>
            {c.flag && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-red-500/[0.08] border border-red-500/20">
                <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" strokeWidth={2} />
                <p className="font-body text-[10px] text-red-300">{c.flag}</p>
              </div>
            )}
            <div className="flex items-center gap-3 mb-4">
              <MicroCheck done={c.intake === 'Done'}     label="Intake"   />
              <MicroCheck done={c.consent === 'Done'}    label="Consent"  />
              <MicroCheck done={c.gfe === 'Cleared'}     label="GFE"      />
            </div>
            <div className="flex gap-2 flex-wrap">
              {c.intake !== 'Done'   && <QuickBtn icon={ClipboardList} label="Mark Intake"   />}
              {c.consent !== 'Done'  && <QuickBtn icon={FileText}      label="Mark Consent"  />}
              {c.gfe !== 'Cleared'   && <QuickBtn icon={Shield}        label="Mark Cleared" accent />}
              <QuickBtn icon={AlertTriangle} label="Escalate" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Payments Screen ──────────────────────────────────────────────────────────
function PaymentsScreen() {
  const mercuryConfigured = isMercuryConfigured();
  const gustoConfigured = isGustoConfigured();
  const quickBooksConfigured = isQuickBooksConfigured();
  const PAY_STATUS_COLOR = {
    Paid: 'text-accent', 'Link Sent': 'text-foreground/50',
    Invoice: 'text-foreground/50', Pending: 'text-foreground/60', Overdue: 'text-red-400',
  };
  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between px-1">
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45">Payments · Manual Tracking</p>
        <span className="font-body text-[9px] text-foreground/50 tracking-[0.1em] uppercase border border-foreground/15 px-2 py-0.5 rounded-full">
          Manual Mode
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-3 text-center">
          <p className="font-heading text-2xl text-foreground">$1,280</p>
          <p className="font-body text-[8px] tracking-[0.15em] uppercase text-foreground/45 mt-0.5">Collected</p>
        </div>
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-3 text-center">
          <p className="font-heading text-2xl text-foreground">$660</p>
          <p className="font-body text-[8px] tracking-[0.15em] uppercase text-foreground/45 mt-0.5">Pending</p>
        </div>
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-3 text-center">
          <p className="font-heading text-2xl text-red-300">$200</p>
          <p className="font-body text-[8px] tracking-[0.15em] uppercase text-red-400/60 mt-0.5">Overdue</p>
        </div>
      </div>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-foreground/[0.10] bg-foreground/[0.05]">
              <Plug className="h-4 w-4 text-foreground/55" strokeWidth={1.7} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-body text-[10px] uppercase tracking-[0.26em] text-foreground/62">
                  Mercury + Gusto + QuickBooks
                </p>
                <span className={`rounded-full border px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.14em] ${
                  mercuryConfigured && gustoConfigured && quickBooksConfigured
                    ? 'border-accent/25 bg-accent/[0.06] text-accent'
                    : 'border-foreground/15 bg-foreground/[0.04] text-foreground/55'
                }`}>
                  {mercuryConfigured && gustoConfigured && quickBooksConfigured ? 'Credentials Detected' : 'Staged'}
                </span>
              </div>
              <p className="mt-2 font-body text-[11px] leading-relaxed text-foreground/50">
                {MERCURY_BANKING_PLACEHOLDER.service} handles banking. {GUSTO_PAYROLL_PLACEHOLDER.service} receives payroll proof after Acuity closeout. {QUICKBOOKS_ACCOUNTING_PLACEHOLDER.service} receives books summaries. No PHI goes to finance exports.
              </p>
            </div>
          </div>
        </div>
      </Card>
      <div className="space-y-2.5">
        {PAYMENTS.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-body text-sm font-semibold text-foreground">{p.client}</p>
                <p className="font-body text-[9px] text-foreground/40">{p.invoice} · {p.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-heading text-xl text-foreground">${p.amount}</p>
                <p className={`font-body text-[9px] font-semibold tracking-[0.1em] uppercase ${PAY_STATUS_COLOR[p.status] || 'text-foreground/50'}`}>
                  {p.status}
                </p>
              </div>
            </div>
            <p className="font-body text-[10px] text-foreground/40 mb-3">{p.method}</p>
            <div className="flex gap-2">
              {p.status !== 'Paid' && (
                <>
                  <QuickBtn icon={Send}       label="Send Link"  />
                  <QuickBtn icon={CreditCard} label="Mark Paid" accent />
                </>
              )}
              <QuickBtn icon={Edit3} label="Note" />
            </div>
          </Card>
        ))}
      </div>
      <div className="rounded-xl border border-foreground/[0.06] px-4 py-3">
        <p className="font-body text-[9px] text-foreground/45 tracking-[0.1em] uppercase">
          Payment tracked manually during launch. Deposits route through Stripe/Acuity; payroll proof queues for Gusto; books summaries stage for QuickBooks.
        </p>
      </div>
    </div>
  );
}

// ─── Follow-Ups Screen ────────────────────────────────────────────────────────
const PRIORITY_COLOR = {
  High: 'text-red-400 border-red-500/25 bg-red-500/[0.06]',
  Med: 'text-foreground/58 border-foreground/15 bg-foreground/[0.035]',
  Low: 'text-foreground/40 border-foreground/10 bg-foreground/[0.02]',
};

function FollowUpsScreen() {
  const [filter, setFilter] = useState('All');
  const filters = ['All','High','Med','Low'];
  const items = filter === 'All' ? FOLLOWUPS : FOLLOWUPS.filter(f => f.priority === filter);
  return (
    <div className="space-y-4 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45 px-1">Follow-Up Queue · {FOLLOWUPS.length} due</p>
      <FilterChips options={filters} active={filter} onChange={setFilter} />
      <div className="space-y-2.5">
        {items.map((f) => (
          <Card key={f.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-body text-sm font-semibold text-foreground">{f.client}</p>
                <p className="font-body text-[10px] text-foreground/50">{f.type}</p>
              </div>
              <span className={`font-body text-[8px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border font-semibold ${PRIORITY_COLOR[f.priority]}`}>
                {f.priority}
              </span>
            </div>
            <p className="font-body text-xs text-foreground/55 mb-3 leading-snug">{f.note}</p>
            <div className="flex gap-2">
              <QuickBtn icon={MessageSquare} label="Text"      />
              <QuickBtn icon={CheckCircle}   label="Done"     accent />
              <QuickBtn icon={Edit3}         label="Note"      />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Plans Screen ─────────────────────────────────────────────────────────────
function MembershipsScreen() {
  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between px-1">
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45">Plan Leads</p>
        <span className="font-body text-[9px] text-foreground/50 tracking-[0.1em] uppercase border border-foreground/15 px-2 py-0.5 rounded-full">
          CRM Sync Pending
        </span>
      </div>
      <div className="space-y-2.5">
        {MEMBERSHIPS.map((m) => (
          <Card key={m.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-body text-sm font-semibold text-foreground">{m.client}</p>
                <p className="font-body text-[10px] text-foreground/40">{m.plan} Plan · {m.sessions} visits</p>
              </div>
              <StatusPill status={m.status} small />
            </div>
            <p className="font-body text-xs text-foreground/55 mb-3 leading-snug">{m.note}</p>
            <div className="flex gap-2">
              <QuickBtn icon={MessageSquare} label="Contact"   />
              <QuickBtn icon={Star}          label="Pitch Plan" accent />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Events Screen ────────────────────────────────────────────────────────────
const EVENT_TYPE_COLOR = { Hotel:'text-foreground/55', Corporate:'text-foreground/55', Event:'text-foreground/55', Venue:'text-foreground/55' };
const EVENT_FIELD = 'min-h-[42px] w-full rounded-xl border border-foreground/[0.10] bg-background/[0.38] px-3 font-body text-xs text-foreground outline-none';

function eventDraftFrom(event = {}) {
  return {
    id: event.id || '',
    name: event.name || '',
    slug: event.slug || '',
    headline: event.headline || event.name || '',
    partner: event.partner || 'Avalon',
    venue: event.venue || '',
    date: event.date || '',
    window: event.window || '',
    service: event.service || 'Event Recovery IV',
    codePrefix: event.codePrefix || 'AV',
    capacity: String(event.capacity || ''),
    source: event.source || 'Avalon presale',
    publicMode: event.publicMode || 'presale',
    publishStatus: event.publishStatus || 'Draft',
    presaleEnabled: event.presaleEnabled !== false,
    leadCaptureEnabled: event.leadCaptureEnabled !== false,
    ticketSystem: Boolean(event.ticketSystem),
    acuityAppointmentTypeID: event.acuityAppointmentTypeID || '',
    gfeLeadDays: String(event.gfeLeadDays || 7),
    description: event.description || '',
    slotsText: (event.slots || []).join(', '),
    ticketTiersText: (event.ticketTiers || []).map((tier) => [tier.name, tier.price, tier.detail].filter(Boolean).join(' | ')).join('\n'),
  };
}

function parseTicketTiers(value = '') {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, price, detail] = line.split('|').map((part) => part.trim());
      return { name: name || 'Ticket', price: price || 'TBD', detail: detail || 'Event reservation.' };
    });
}

function EventsScreen() {
  const [presales, setPresales] = useState(() => readEventPresales());
  const [activeEventId, setActiveEventId] = useState(() => readEventPresales().events[0]?.id || '');
  const [notice, setNotice] = useState('');
  const activeEvent = presales.events.find((event) => event.id === activeEventId) || presales.events[0];
  const summary = buildPresaleSummary(presales);
  const activeSummary = summary.find((event) => event.id === activeEvent?.id) || summary[0];
  const activeCodes = presales.codes.filter((code) => code.eventId === activeEvent?.id);
  const activeRedemptions = presales.redemptions.filter((item) => item.eventId === activeEvent?.id);
  const presaleLink = activeEvent ? `${window.location.origin}/presale/${activeEvent.id}` : '';
  const eventPageLink = activeEvent ? `${window.location.origin}/events/${activeEvent.slug || activeEvent.id}` : '';
  const [draft, setDraft] = useState(() => eventDraftFrom(activeEvent));

  const refreshPresales = (next) => {
    const updated = next || readEventPresales();
    setPresales(updated);
    const selected = updated.events.find((event) => event.id === activeEventId) || updated.events[0];
    if (selected) setDraft(eventDraftFrom(selected));
  };

  const copyPresaleLink = async () => {
    if (!presaleLink) return;
    try {
      await navigator.clipboard.writeText(presaleLink);
      setNotice('Presale link copied');
    } catch {
      setNotice(presaleLink);
    }
  };

  const copyEventPageLink = async () => {
    if (!eventPageLink) return;
    try {
      await navigator.clipboard.writeText(eventPageLink);
      setNotice('Event page copied');
    } catch {
      setNotice(eventPageLink);
    }
  };

  const generateCodes = (count) => {
    if (!activeEvent) return;
    refreshPresales(generatePresaleCodes(activeEvent.id, count));
    setNotice(`${count} codes generated for ${activeEvent.name}`);
  };

  const importPartnerPresale = () => {
    if (!activeEvent) return;
    refreshPresales(acceptExternalPresale({
      eventId: activeEvent.id,
      source: 'Partner import',
      partnerRef: `PARTNER-${Date.now().toString().slice(-5)}`,
      clientName: 'Guest pending',
    }));
    setNotice('Partner presale imported');
  };

  const selectEvent = (eventId) => {
    setActiveEventId(eventId);
    const selected = presales.events.find((event) => event.id === eventId) || presales.events[0];
    setDraft(eventDraftFrom(selected));
  };

  const saveEditor = () => {
    const savedId = draft.id || activeEvent?.id;
    const next = saveEventPresale({
      ...activeEvent,
      ...draft,
      capacity: Number(draft.capacity || 0),
      gfeLeadDays: Number(draft.gfeLeadDays || 7),
      slots: draft.slotsText.split(',').map((slot) => slot.trim()).filter(Boolean),
      ticketTiers: parseTicketTiers(draft.ticketTiersText),
    });
    setPresales(next);
    setActiveEventId(savedId);
    const saved = next.events.find((event) => event.id === savedId) || next.events[0];
    if (saved) setDraft(eventDraftFrom(saved));
    setNotice('Event page saved');
  };

  const createEvent = () => {
    const id = `event-${Date.now()}`;
    const nextDraft = eventDraftFrom({
      id,
      name: 'New Event Presale',
      slug: `new-event-${Date.now().toString().slice(-4)}`,
      headline: 'New Event Presale',
      venue: 'Venue pending',
      date: 'Date pending',
      window: 'Event window',
      service: 'Event Recovery IV',
      codePrefix: 'AV',
      capacity: 60,
      description: 'Avalon event recovery page.',
      slots: ['First available'],
    });
    setActiveEventId(id);
    setDraft(nextDraft);
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminAccordion title="Event Presale Bridge" icon={Ticket} meta={`${activeRedemptions.length} redeemed`} defaultOpen>
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {summary.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => selectEvent(event.id)}
                className={`rounded-2xl border p-3 text-left transition-all ${
                  activeEvent?.id === event.id
                    ? 'border-foreground/45 bg-foreground text-background'
                    : 'border-foreground/[0.08] bg-background/[0.22] text-foreground hover:border-foreground/25'
                }`}
              >
                <p className="font-body text-[8px] uppercase tracking-[0.18em] opacity-60">{event.partner}</p>
                <p className="mt-1 font-body text-xs font-semibold">{event.name}</p>
                <p className="mt-1 font-body text-[10px] opacity-60">{event.redeemed}/{event.capacity || '∞'} redeemed</p>
              </button>
            ))}
          </div>

          {activeEvent && (
            <Card className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-body text-[9px] uppercase tracking-[0.24em] text-foreground/45">Active Event</p>
                  <h3 className="mt-1 font-heading text-2xl uppercase leading-none text-foreground">{activeEvent.name}</h3>
                  <p className="mt-2 font-body text-xs text-foreground/50">{activeEvent.date} · {activeEvent.window} · {activeEvent.venue}</p>
                  <p className="mt-1 font-body text-xs text-foreground/50">{activeEvent.service}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[15rem]">
                  {[
                    ['Generated', activeSummary?.generated || 0],
                    ['Available', activeSummary?.available || 0],
                    ['GFE Queue', activeSummary?.gfePending || 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-foreground/[0.08] bg-background/[0.22] p-3">
                      <p className="font-heading text-xl text-foreground">{value}</p>
                      <p className="font-body text-[8px] uppercase tracking-[0.16em] text-foreground/45">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-foreground/[0.08] bg-background/[0.24] p-3">
                <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Special Link</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 truncate rounded-xl border border-foreground/[0.08] bg-card/[0.65] px-3 py-2 font-body text-[11px] text-foreground/62">
                    {presaleLink}
                  </code>
                  <QuickBtn icon={FileText} label="Copy" onClick={copyPresaleLink} accent />
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 truncate rounded-xl border border-foreground/[0.08] bg-card/[0.65] px-3 py-2 font-body text-[11px] text-foreground/62">
                    {eventPageLink}
                  </code>
                  <QuickBtn icon={Calendar} label="Page" onClick={copyEventPageLink} />
                </div>
                {notice && <p className="mt-2 font-body text-[10px] text-foreground/48">{notice}</p>}
              </div>

              <div className="mt-4 rounded-2xl border border-foreground/[0.08] bg-background/[0.24] p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/45">Event Page Editor</p>
                  <QuickBtn icon={Plus} label="New" onClick={createEvent} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input aria-label="Event name" className={EVENT_FIELD} value={draft.name} onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))} placeholder="Event name" />
                  <input aria-label="Public event slug" className={EVENT_FIELD} value={draft.slug} onChange={(event) => setDraft((d) => ({ ...d, slug: event.target.value }))} placeholder="public-event-slug" />
                  <input aria-label="Event partner" className={EVENT_FIELD} value={draft.partner} onChange={(event) => setDraft((d) => ({ ...d, partner: event.target.value }))} placeholder="Partner" />
                  <input aria-label="Event venue" className={EVENT_FIELD} value={draft.venue} onChange={(event) => setDraft((d) => ({ ...d, venue: event.target.value }))} placeholder="Venue" />
                  <input aria-label="Event date" className={EVENT_FIELD} value={draft.date} onChange={(event) => setDraft((d) => ({ ...d, date: event.target.value }))} placeholder="Date" />
                  <input aria-label="Event window" className={EVENT_FIELD} value={draft.window} onChange={(event) => setDraft((d) => ({ ...d, window: event.target.value }))} placeholder="Window" />
                  <input aria-label="Event service" className={EVENT_FIELD} value={draft.service} onChange={(event) => setDraft((d) => ({ ...d, service: event.target.value }))} placeholder="Service" />
                  <input aria-label="Event code prefix" className={EVENT_FIELD} value={draft.codePrefix} onChange={(event) => setDraft((d) => ({ ...d, codePrefix: event.target.value.toUpperCase() }))} placeholder="Code prefix" />
                  <input aria-label="Event capacity" className={EVENT_FIELD} value={draft.capacity} onChange={(event) => setDraft((d) => ({ ...d, capacity: event.target.value }))} placeholder="Capacity" inputMode="numeric" />
                  <input aria-label="GFE lead days before event" className={EVENT_FIELD} value={draft.gfeLeadDays} onChange={(event) => setDraft((d) => ({ ...d, gfeLeadDays: event.target.value }))} placeholder="GFE lead days" inputMode="numeric" />
                  <select aria-label="Event public mode" className={EVENT_FIELD} value={draft.publicMode} onChange={(event) => setDraft((d) => ({ ...d, publicMode: event.target.value }))}>
                    <option value="lead">Lead capture</option>
                    <option value="showcase">Showcase</option>
                    <option value="presale">Presale</option>
                    <option value="ticketed">Ticketed</option>
                  </select>
                  <select aria-label="Event publish status" className={EVENT_FIELD} value={draft.publishStatus} onChange={(event) => setDraft((d) => ({ ...d, publishStatus: event.target.value }))}>
                    <option>Draft</option>
                    <option>Published</option>
                    <option>Private Link</option>
                    <option>Sold Out</option>
                  </select>
                </div>
                <textarea aria-label="Public event description" className={`${EVENT_FIELD} mt-2 min-h-[74px] py-3`} value={draft.description} onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))} placeholder="Public event description" />
                <textarea aria-label="Event slots" className={`${EVENT_FIELD} mt-2 min-h-[64px] py-3`} value={draft.slotsText} onChange={(event) => setDraft((d) => ({ ...d, slotsText: event.target.value }))} placeholder="Slots, comma separated" />
                <textarea aria-label="Event ticket tiers" className={`${EVENT_FIELD} mt-2 min-h-[82px] py-3`} value={draft.ticketTiersText} onChange={(event) => setDraft((d) => ({ ...d, ticketTiersText: event.target.value }))} placeholder="Ticket tiers: Name | Price | Detail" />
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ['presaleEnabled', 'Presale'],
                    ['ticketSystem', 'Tickets'],
                    ['leadCaptureEnabled', 'Leads'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, [key]: !d[key] }))}
                      className={`rounded-xl border px-3 py-2 font-body text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        draft[key] ? 'border-foreground bg-foreground text-background' : 'border-foreground/[0.14] text-foreground/55'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <QuickBtn icon={FileText} label="Save Page" onClick={saveEditor} accent />
                  <QuickBtn icon={QrCode} label="Open Page" onClick={() => window.open(eventPageLink, '_blank', 'noopener,noreferrer')} />
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <QuickBtn icon={Plus} label="Generate 10" onClick={() => generateCodes(10)} />
                <QuickBtn icon={Ticket} label="Import Partner" onClick={importPartnerPresale} />
                <QuickBtn icon={QrCode} label="Open Redeem" onClick={() => window.open(presaleLink, '_blank', 'noopener,noreferrer')} accent />
              </div>
            </Card>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="border-b border-foreground/[0.08] px-4 py-3">
                <p className="font-body text-[9px] uppercase tracking-[0.24em] text-foreground/45">Codes</p>
              </div>
              <div className="max-h-64 overflow-auto">
                {activeCodes.length ? activeCodes.slice(0, 12).map((code) => (
                  <div key={code.id} className="flex items-center justify-between gap-3 border-b border-foreground/[0.06] px-4 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate font-body text-xs font-semibold text-foreground">{code.code}</p>
                      <p className="font-body text-[10px] text-foreground/45">{code.source}{code.partnerRef ? ` · ${code.partnerRef}` : ''}</p>
                    </div>
                    <StatusPill status={code.status} small />
                  </div>
                )) : (
                  <p className="px-4 py-6 font-body text-xs text-foreground/45">No codes generated yet.</p>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-foreground/[0.08] px-4 py-3">
                <p className="font-body text-[9px] uppercase tracking-[0.24em] text-foreground/45">Redeemed Guests</p>
              </div>
              <div className="max-h-64 overflow-auto">
                {activeRedemptions.length ? activeRedemptions.map((item) => (
                  <div key={item.id} className="border-b border-foreground/[0.06] px-4 py-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-body text-xs font-semibold text-foreground">{item.client.name}</p>
                        <p className="font-body text-[10px] text-foreground/45">{item.selectedTime} · {item.code}</p>
                      </div>
                      <span className="rounded-full border border-foreground/[0.10] px-2 py-1 font-body text-[8px] uppercase tracking-[0.14em] text-foreground/48">
                        {item.credential}
                      </span>
                    </div>
                    <p className="mt-2 font-body text-[10px] text-foreground/48">{item.intakeStatus} · {item.scheduleStatus}</p>
                  </div>
                )) : (
                  <p className="px-4 py-6 font-body text-xs text-foreground/45">No guest redemptions yet.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </AdminAccordion>

      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45 px-1">B2B / Event Leads</p>
      <div className="space-y-2.5">
        {EVENTS_LEADS.map((e) => (
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`font-body text-[8px] tracking-[0.15em] uppercase font-semibold ${EVENT_TYPE_COLOR[e.type] || 'text-foreground/50'}`}>{e.type}</span>
                </div>
                <p className="font-body text-sm font-semibold text-foreground">{e.org}</p>
                <p className="font-body text-[10px] text-foreground/40">{e.contact} · {e.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-heading text-lg text-foreground">{e.value}</p>
                <StatusPill status={e.status} small />
              </div>
            </div>
            <div className="flex gap-2">
              <QuickBtn icon={MessageSquare} label="Contact"  />
              <QuickBtn icon={FileText}      label="Proposal" accent />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Inventory Screen ─────────────────────────────────────────────────────────
const INV_COLOR = { Ready:'text-accent', 'Low Stock':'text-foreground/55', 'Restock Needed':'text-red-400', 'Check Expiry':'text-foreground/55', 'Not Set':'text-foreground/45' };

function InventoryScreen() {
  return (
    <div className="space-y-4 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45 px-1">Kit & Supply Status</p>
      <div className="grid grid-cols-2 gap-2.5">
        {INVENTORY.map((item) => (
          <Card key={item.id} className="p-4">
            <p className={`font-body text-[8px] tracking-[0.2em] uppercase font-semibold mb-1.5 ${INV_COLOR[item.status] || 'text-foreground/40'}`}>
              {item.status}
            </p>
            <p className="font-body text-sm font-semibold text-foreground leading-tight mb-0.5">{item.name}</p>
            <p className="font-body text-[10px] text-foreground/40">{item.detail}</p>
            {item.note && (
              <p className="font-body text-[9px] text-foreground/45 mt-1.5 leading-snug">{item.note}</p>
            )}
          </Card>
        ))}
      </div>
      <div className="flex gap-2">
        <QuickBtn icon={RefreshCw} label="Request Restock" />
        <QuickBtn icon={Edit3}     label="Update Counts"  accent />
      </div>
    </div>
  );
}

// ─── Reports Screen ───────────────────────────────────────────────────────────
function ReportsScreen() {
  const stats = [
    { label:'Requests This Week', value:'23',    sub:'↑ 4 vs last week' },
    { label:'Confirmed Visits',   value:'18',    sub:'78% confirmation rate' },
    { label:'Completed Visits',   value:'14',    sub:'61% completion rate' },
    { label:'Revenue (Est.)',      value:'$4,820',sub:'Manual total' },
    { label:'Top Source',         value:'Instagram',sub:'9 of 23 requests' },
    { label:'Top Therapy',        value:"Myers Cocktail",sub:'8 bookings' },
    { label:'Plan Interest',value:'5 leads',sub:'2 ready to close' },
    { label:'Avg Ticket',         value:'$280',  sub:'Per completed visit' },
  ];
  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between px-1">
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/45">Weekly Snapshot</p>
        <span className="font-body text-[9px] text-foreground/45 tracking-[0.1em] uppercase">Manual Estimates</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/45 mb-1.5">{s.label}</p>
            <p className="font-heading text-2xl text-foreground leading-none">{s.value}</p>
            <p className="font-body text-[9px] text-foreground/45 mt-1">{s.sub}</p>
          </Card>
        ))}
      </div>
      <div className="rounded-xl border border-foreground/[0.06] px-4 py-3">
        <p className="font-body text-[9px] text-foreground/45 tracking-[0.1em] uppercase">
          Automation Placeholder · Analytics integration launches post-beta.
        </p>
      </div>
    </div>
  );
}

// ─── More Menu Sheet ──────────────────────────────────────────────────────────
const MORE_NAV = [
  { screen:'payments',    icon: CreditCard,   label: 'Payments',          href: null           },
  { screen:'followups',   icon: Heart,        label: 'Follow',            href: null           },
  { screen:'memberships', icon: Star,         label: 'Plans',             href: null           },
  { screen:'events',      icon: Calendar,     label: 'Groups',            href: null           },
  { screen:'inventory',   icon: Package,      label: 'Inventory',         href: '/admin/inventory' },
  { screen:'reports',     icon: TrendingUp,   label: 'Reports',           href: null           },
];

function MoreMenuSheet({ onClose, onNav, onSignOut }) {
  return (
    <motion.div
      initial={{ y:'100%' }} animate={{ y: 0 }} exit={{ y:'100%' }}
      transition={{ duration: 0.38, ease: EASE }}
      className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-foreground/[0.1] rounded-t-3xl"
      style={{ paddingBottom:'max(env(safe-area-inset-bottom), 1.5rem)' }}
    >
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10"
        onClick={onClose}
      />
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-foreground/20" />
      </div>
      <div className="flex items-center justify-between px-5 py-3 border-b border-foreground/[0.06]">
        <p className="font-heading text-xl text-foreground uppercase tracking-wide">More</p>
        <button type="button" onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/50">
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
      <nav className="px-3 py-3">
        {MORE_NAV.map(({ screen, icon: Icon, label, href }) => {
          const itemClass = "w-full flex items-center gap-3.5 px-3 py-3.5 rounded-xl mb-0.5 text-left hover:bg-foreground/[0.04] transition-colors";
          const inner = (
            <>
              <Icon className="w-5 h-5 text-foreground/45 shrink-0" strokeWidth={1.5} />
              <span className="font-body text-sm text-foreground">{label}</span>
              <ChevronRight className="w-4 h-4 text-foreground/45 ml-auto" strokeWidth={1.5} />
            </>
          );
          return href ? (
            <Link key={screen} to={href} onClick={onClose} className={itemClass}>
              {inner}
            </Link>
          ) : (
            <button key={screen} type="button" onClick={() => { onNav(screen); onClose(); }} className={itemClass}>
              {inner}
            </button>
          );
        })}
      </nav>
      <div className="px-3 pt-2 border-t border-foreground/[0.06]">
        <Link to="/" onClick={onClose}
          className="flex items-center gap-3.5 px-3 py-3 rounded-xl text-foreground/50 hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5 shrink-0" strokeWidth={1.5} />
          <span className="font-body text-sm">Back to Site</span>
        </Link>
        <button type="button" onClick={onSignOut}
          className="w-full flex items-center gap-3.5 px-3 py-3.5 rounded-xl bg-red-500/[0.07] border border-red-500/20 text-red-400 hover:bg-red-500/[0.12] transition-colors mt-1">
          <LogOut className="w-5 h-5 shrink-0" strokeWidth={1.5} />
          <span className="font-body text-sm font-semibold">Sign Out</span>
        </button>
      </div>
    </motion.div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
const BOTTOM_NAV = [
  { screen:'command',   icon: LayoutDashboard, label: 'Ops'   },
  { screen:'requests',  icon: ClipboardList,   label: 'Visits'  },
  { screen:'nurses',    icon: Users,           label: 'Team'    },
  { screen:'clearance', icon: Shield,          label: 'Clear' },
];

// All screens for desktop sidebar (primary + secondary)
const SIDEBAR_NAV = [
  { screen:'command',     icon: LayoutDashboard, label: 'Ops',            href: null          },
  { screen:'requests',    icon: ClipboardList,   label: 'Visits',         href: null          },
  { screen:'nurses',      icon: Users,           label: 'Team',           href: null          },
  { screen:'clearance',   icon: Shield,          label: 'Clear',          href: null          },
  { screen:'payments',    icon: CreditCard,      label: 'Payments',       href: null          },
  { screen:'followups',   icon: Heart,           label: 'Follow',         href: null          },
  { screen:'memberships', icon: Star,            label: 'Plans',          href: null          },
  { screen:'events',      icon: Calendar,        label: 'Groups',         href: null          },
  { screen:'inventory',   icon: Package,         label: 'Inventory',      href: '/admin/inventory' },
  { screen:'reports',     icon: TrendingUp,      label: 'Reports',        href: null          },
  { screen:'messages',    icon: MessageSquare,   label: 'Messages',       href: null          },
];

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
function DesktopSidebar({ activeScreen, onNav, onSignOut }) {
  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-foreground/[0.08] bg-background overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-foreground/[0.06] shrink-0">
        <Link to="/" className="inline-block font-heading text-2xl leading-none tracking-[0.2em] text-foreground transition-colors hover:text-foreground/70">
          AV
        </Link>
        <p className="font-body text-[8px] tracking-[0.15em] uppercase text-foreground/45 mt-0.5">{TODAY_LABEL}</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {SIDEBAR_NAV.map(({ screen, icon: Icon, label, href }) => {
          const active = activeScreen === screen;
          const cls = `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
            active
              ? 'bg-foreground/[0.08] text-foreground'
              : 'text-foreground/50 hover:bg-foreground/[0.04] hover:text-foreground/75'
          }`;
          const inner = (
            <>
              <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2 : 1.5} />
              <span className={`font-body text-[10px] tracking-[0.1em] uppercase ${active ? 'font-semibold text-foreground' : ''}`}>
                {label}
              </span>
              {active && <span className="ml-auto w-1 h-3 rounded-full bg-accent" />}
            </>
          );
          return href
            ? <Link key={screen} to={href} className={cls}>{inner}</Link>
            : <button key={screen} type="button" onClick={() => onNav(screen)} className={cls}>{inner}</button>;
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-foreground/[0.06] shrink-0 space-y-1">
        <Link to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground/40 hover:text-foreground/60 transition-colors">
          <ArrowLeft className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span className="font-body text-[10px] tracking-[0.1em] uppercase">Back to Site</span>
        </Link>
        <button type="button" onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors">
          <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span className="font-body text-[10px] tracking-[0.1em] uppercase">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Command() {
  const { signOut }                        = useAuthStore();
  const navigate                           = useNavigate();
  const [screen, setScreen]               = useState('command');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [moreOpen, setMoreOpen]           = useState(false);
  const [opsTick, setOpsTick]             = useState(0);

  useEffect(() => {
    document.title = 'Admin Command - Avalon Vitality';
  }, []);

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  function handleRequestUpdate(nextRequest) {
    setSelectedRequest(nextRequest);
    setOpsTick((value) => value + 1);
  }

  function openNotifications() {
    setScreen('command');
    setOpsTick((value) => value + 1);
  }

  const screenTitles = {
    command:     'AVALON OS',
    requests:    'REQUEST QUEUE',
    nurses:      'NURSE BOARD',
    clearance:   'CLEARANCE',
    payments:    'PAYMENTS',
    followups:   'FOLLOW',
    memberships: 'PLANS',
    events:      'GROUPS',
    inventory:   'INVENTORY',
    reports:     'REPORTS',
    messages:    'MESSAGES',
  };

  const isMoreScreen = !BOTTOM_NAV.find(n => n.screen === screen);
  return (
    // Full-screen shell — flex-row on desktop (sidebar + content), flex-col on mobile
    <div className="h-screen bg-background text-foreground flex flex-col md:flex-row overflow-hidden" style={{ height: '100dvh' }}>

      {/* ── Desktop Sidebar (md+) ────────────────────────────────── */}
      <DesktopSidebar
        activeScreen={screen}
        onNav={(s) => setScreen(s)}
        onSignOut={handleSignOut}
      />

      {/* ── Main column ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Top Bar ─────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-foreground/[0.08] bg-background/92 backdrop-blur-xl">
          <div className="relative grid grid-cols-[8.5rem_1fr_8.5rem] items-center px-4 py-3 md:flex md:justify-between md:px-6">
            <div className="flex min-w-0 items-center gap-3 justify-self-start">
              {/* Back arrow — mobile only, for "more" screens */}
              {isMoreScreen && (
                <button type="button" onClick={() => setScreen('command')}
                  className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/[0.08] bg-card/[0.68] text-foreground/50 hover:text-foreground">
                  <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                </button>
              )}
              {/* AV logo — mobile only; desktop shows it in sidebar */}
              <Link to="/" className="md:hidden">
                <span className="block font-heading text-2xl leading-none tracking-[0.2em] text-foreground">AV</span>
                <p className="font-body text-[10px] tracking-[0.12em] uppercase text-foreground/40 mt-0.5">{TODAY_LABEL}</p>
              </Link>
              <div className="hidden md:block">
                <p className="font-body text-[10px] uppercase tracking-[0.18em] text-foreground/40">{TODAY_LABEL}</p>
                <p className="font-body text-[11px] text-foreground/58">Ops</p>
              </div>
            </div>
            <h1 className="pointer-events-none justify-self-center whitespace-nowrap text-center font-heading text-[1.7rem] uppercase leading-none tracking-[0.08em] text-foreground md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:text-3xl">
              {screenTitles[screen]}
            </h1>
            <div className="flex items-center justify-end gap-1.5 justify-self-end">
              <button
                type="button"
                onClick={() => setScreen('clearance')}
                className="hidden rounded-full border border-red-400/25 bg-red-400/[0.08] px-2.5 py-1 font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-red-300 transition-colors hover:bg-red-400/[0.14] sm:inline-flex"
                aria-label="Open blocked clearance items"
              >
                6
              </button>
              <button
                type="button"
                onClick={openNotifications}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-foreground/[0.08] bg-card/[0.68] text-foreground/55 transition-colors hover:text-foreground"
                aria-label="Open nurse alerts and dispatch messages"
                title="Alerts"
              >
                <Bell className="w-4 h-4" strokeWidth={1.5} />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-400" />
              </button>
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/[0.08] bg-card/[0.68] text-foreground/55 transition-colors hover:text-foreground"
                aria-label="Open admin account menu"
                title="Account"
              >
                <User className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Screen title */}
          <div className="hidden px-4 pb-3 text-center md:px-6">
            <p className="font-heading text-3xl text-foreground uppercase leading-none tracking-tight md:text-4xl">
              {screenTitles[screen]}
            </p>
          </div>
        </div>

        {/* ── Screen Content ──────────────────────────────────────── */}
        <main
          className="flex-1 overflow-y-auto px-4 pt-3 md:px-8 md:pt-5"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 5.5rem)' }}
        >
          <div className="mx-auto max-w-5xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={screen}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: EASE }}
              >
                {screen === 'command'     && <CommandScreen key={opsTick} onSelectRequest={setSelectedRequest} />}
                {screen === 'requests'    && <RequestsScreen  onSelectRequest={setSelectedRequest} />}
                {screen === 'nurses'      && <NursesScreen />}
                {screen === 'clearance'   && <ClearanceScreen />}
                {screen === 'payments'    && <PaymentsScreen />}
                {screen === 'followups'   && <FollowUpsScreen />}
                {screen === 'memberships' && <MembershipsScreen />}
                {screen === 'events'      && <EventsScreen />}
                {screen === 'inventory'   && <InventoryScreen />}
                {screen === 'reports'     && <ReportsScreen />}
                {screen === 'messages'    && (
                  <div className="h-full p-4">
                    <Suspense fallback={<p className="font-body text-xs text-foreground/45 text-center py-8">Loading…</p>}>
                      <MessagingPanel />
                    </Suspense>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ── Mobile Bottom Nav (hidden on desktop) ───────────────── */}
        <div
          className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-foreground/[0.12] bg-background"
          style={{ paddingBottom:'max(env(safe-area-inset-bottom), 0px)' }}
        >
          <div className="flex items-stretch max-w-[430px] mx-auto">
            {BOTTOM_NAV.map(({ screen: s, icon: Icon, label }) => {
              const active = screen === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScreen(s)}
                  className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 relative transition-colors"
                  style={{ color: active ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.65)' }}
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-accent" />
                  )}
                  {s === 'requests' && (
                    <span className="absolute top-2 right-1/4 w-4 h-4 rounded-full bg-accent text-background font-body text-[8px] font-bold flex items-center justify-center leading-none">
                      {REQUESTS.filter(r => r.status === 'New Request').length}
                    </span>
                  )}
                  <Icon className="w-[22px] h-[22px] shrink-0" strokeWidth={active ? 2 : 1.5} />
                  <span className={`font-body text-[9px] tracking-[0.08em] uppercase leading-none ${active ? 'font-semibold' : ''}`}>{label}</span>
                </button>
              );
            })}
            {/* More */}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 relative transition-colors"
              style={{ color: isMoreScreen ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.65)' }}
            >
              {isMoreScreen && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-accent" />
              )}
              <MoreHorizontal className="w-[22px] h-[22px] shrink-0" strokeWidth={isMoreScreen ? 2 : 1.5} />
              <span className={`font-body text-[9px] tracking-[0.08em] uppercase leading-none ${isMoreScreen ? 'font-semibold' : ''}`}>More</span>
            </button>
          </div>
        </div>

      </div>

      {/* ── Visit Detail Sheet ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedRequest && (
          <VisitDetailSheet
            req={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onUpdate={handleRequestUpdate}
          />
        )}
      </AnimatePresence>

      {/* ── More Menu Sheet (mobile only) ────────────────────────── */}
      <AnimatePresence>
        {moreOpen && (
          <MoreMenuSheet
            onClose={() => setMoreOpen(false)}
            onNav={(s) => setScreen(s)}
            onSignOut={() => { setMoreOpen(false); handleSignOut(); }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
