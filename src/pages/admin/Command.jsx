import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/useAuthStore';
import {
  Bell, User, Home, Hotel, Building2, Calendar, MapPin,
  Zap, Droplets, FlaskConical, Sparkles, Syringe, Package,
  Phone, MessageSquare, CheckCircle, AlertTriangle, AlertCircle,
  Clock, DollarSign, Users, FileText, ClipboardList, Shield,
  ChevronDown, X, Plus, ArrowLeft, MoreHorizontal,
  Activity, CreditCard, Send, Edit3,
  LayoutDashboard, LogOut, Check, RefreshCw,
  Star, TrendingUp, Flame, Heart, ChevronRight,
  Sun, Moon, Sunset,
} from 'lucide-react';

// ─── Theme helpers (mirrors Navbar) ──────────────────────────────────────────
const THEMES = ['dark', 'light', 'golden', 'dubs'];
const THEME_KEY = 'avalon.theme';
const Thirty = (props) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <text x="12" y="19.5" textAnchor="middle" fontSize="22" fontWeight="900" fill="currentColor"
      fontFamily="'Bebas Neue','Impact','Arial Black',sans-serif" letterSpacing="0.02em">30</text>
  </svg>
);
function readTheme() {
  try { const s = localStorage.getItem(THEME_KEY); if (s && THEMES.includes(s)) return s; } catch {}
  return 'dark';
}
function useAdminTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'golden', 'dubs');
    if (theme !== 'light') document.documentElement.classList.add(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);
  const cycle = () => setTheme(prev => THEMES[(THEMES.indexOf(prev) + 1) % THEMES.length]);
  const Icon = theme === 'dark' ? Sun : theme === 'light' ? Moon : theme === 'dubs' ? Thirty : Sunset;
  return { theme, cycle, Icon };
}

const EASE = [0.16, 1, 0.3, 1];
const TODAY_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', ' ·');

// ─── Status config ────────────────────────────────────────────────────────────
const ST = {
  'New Request':     { cls: 'bg-blue-500/15 text-blue-300 border-blue-500/25',         dot: 'bg-blue-400' },
  'Contacted':       { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25',       dot: 'bg-amber-400' },
  'Confirmed':       { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  'Intake Pending':  { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    dot: 'bg-orange-400' },
  'Consent Pending': { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    dot: 'bg-orange-400' },
  'GFE Pending':     { cls: 'bg-red-500/15 text-red-300 border-red-500/25',             dot: 'bg-red-400' },
  'Cleared':         { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  'Nurse Assigned':  { cls: 'bg-teal-500/15 text-teal-300 border-teal-500/25',          dot: 'bg-teal-400' },
  'Payment Pending': { cls: 'bg-red-500/15 text-red-300 border-red-500/25',             dot: 'bg-red-400' },
  'Ready for Visit': { cls: 'bg-green-400/15 text-green-300 border-green-400/25',       dot: 'bg-green-300' },
  'Completed':       { cls: 'bg-foreground/8 text-foreground/45 border-foreground/10',  dot: 'bg-foreground/30' },
  'Follow-Up Due':   { cls: 'bg-purple-500/15 text-purple-300 border-purple-500/25',    dot: 'bg-purple-400' },
  'Cancelled':       { cls: 'bg-red-900/20 text-red-400/60 border-red-900/25',          dot: 'bg-red-700' },
  'Paid':            { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  'Link Sent':       { cls: 'bg-blue-500/15 text-blue-300 border-blue-500/25',          dot: 'bg-blue-400' },
  'Overdue':         { cls: 'bg-red-500/15 text-red-300 border-red-500/25',             dot: 'bg-red-400' },
  'Invoice':         { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25',       dot: 'bg-amber-400' },
  'Pending':         { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    dot: 'bg-orange-400' },
  'Available':       { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  'Assigned':        { cls: 'bg-teal-500/15 text-teal-300 border-teal-500/25',          dot: 'bg-teal-400' },
  'Off Duty':        { cls: 'bg-foreground/8 text-foreground/45 border-foreground/10',  dot: 'bg-foreground/30' },
  'Ready':           { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  'Low Stock':       { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25',       dot: 'bg-amber-400' },
  'Restock Needed':  { cls: 'bg-red-500/15 text-red-300 border-red-500/25',             dot: 'bg-red-400' },
  'Check Expiry':    { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    dot: 'bg-orange-400' },
  'Won':             { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  'Lost':            { cls: 'bg-foreground/8 text-foreground/45 border-foreground/10',  dot: 'bg-foreground/30' },
  'New':             { cls: 'bg-blue-500/15 text-blue-300 border-blue-500/25',          dot: 'bg-blue-400' },
  'Proposal Needed': { cls: 'bg-purple-500/15 text-purple-300 border-purple-500/25',    dot: 'bg-purple-400' },
  'Follow-Up':       { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25',       dot: 'bg-amber-400' },
  'Active Placeholder': { cls: 'bg-teal-500/15 text-teal-300 border-teal-500/25',       dot: 'bg-teal-400' },
  'Interested':      { cls: 'bg-blue-500/15 text-blue-300 border-blue-500/25',          dot: 'bg-blue-400' },
};

function pill(status) {
  return ST[status] || { cls: 'bg-foreground/8 text-foreground/50 border-foreground/10', dot: 'bg-foreground/30' };
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const REQUESTS = [
  { id:'r1', client:'Serena W.',    phone:'(415) 555-1004', email:'serena.w@gmail.com',
    locationType:'hotel',  address:'Four Seasons SF, Suite 1104',    city:'SF',
    time:'Today 3:00 PM',  therapy:'VIP Recovery Package', addons:['Glutathione Push','B12 Shot'],
    total:450, status:'Ready for Visit', source:'Hotel',    priority:'VIP',
    intake:'Done', consent:'Done', gfe:'Cleared',       nurse:'Stephanie R.', payment:'Paid',
    guests:1, notes:'Allergic to latex. Prefers cooler room temp.', created:'9:15 AM' },
  { id:'r2', client:'Alex Chen',    phone:'(415) 555-1001', email:'alex.chen@gmail.com',
    locationType:'home',   address:'188 King St, Apt 2205',           city:'SF',
    time:'Today 5:00 PM',  therapy:"Myers Cocktail + NAD+",           addons:['NAD+ (250mg)'],
    total:600, status:'GFE Pending',     source:'Website',  priority:'VIP',
    intake:'Done', consent:'Done', gfe:'Pending',       nurse:'Unassigned',   payment:'Pending',
    guests:1, notes:'Recurring client. Requests Stephanie when available.', created:'8:42 AM' },
  { id:'r3', client:'Maya Patel',   phone:'(415) 555-1002', email:'maya.patel@gmail.com',
    locationType:'home',   address:'3388 22nd St',                    city:'SF',
    time:'Today 6:30 PM',  therapy:'Immunity Drip',                   addons:[],
    total:250, status:'Nurse Assigned',  source:'Referral', priority:null,
    intake:'Done', consent:'Done', gfe:'Cleared',       nurse:'Marcus T.',    payment:'Pending',
    guests:1, notes:'', created:'10:05 AM' },
  { id:'r4', client:'Tyler Brooks', phone:'(415) 555-1003', email:'tyler@startup.io',
    locationType:'office',  address:'270 Brannan St, Floor 4',         city:'SF',
    time:'Tomorrow 9:00 AM',therapy:'Energy Drip',                    addons:['Extra Fluid'],
    total:825, status:'Confirmed',       source:'Corporate',priority:'Corporate',
    intake:'Done', consent:'Pending', gfe:'Pending',    nurse:'Unassigned',   payment:'Invoice',
    guests:3, notes:'Group of 3. Corporate invoice billing.', created:'Yesterday' },
  { id:'r5', client:'Priya Sharma', phone:'(415) 555-1008', email:'priya.sharma@gmail.com',
    locationType:'home',   address:'1042 Fulton St, Apt 3B',           city:'SF',
    time:'Today 4:00 PM',  therapy:'Hydration Boost',                 addons:[],
    total:150, status:'Intake Pending',  source:'Google',   priority:null,
    intake:'Pending', consent:'Pending', gfe:'Not Started', nurse:'Unassigned', payment:'Pending',
    guests:1, notes:'New client. First visit. Nervous about needles.', created:'11:30 AM' },
  { id:'r6', client:'David Nguyen', phone:'(415) 555-1007', email:'david@startup.io',
    locationType:'office',  address:'270 Brannan St',                   city:'SF',
    time:'Today 2:00 PM',  therapy:"Myers Cocktail",                   addons:[],
    total:200, status:'Contacted',       source:'Website',  priority:null,
    intake:'Done', consent:'Done', gfe:'Cleared',       nurse:'Unassigned',   payment:'Pending',
    guests:1, notes:'Payment link sent via email.', created:'7:50 AM' },
  { id:'r7', client:'Sofia Reyes',  phone:'(415) 555-1010', email:'sofia.reyes@gmail.com',
    locationType:'home',   address:'500 Florida St',                   city:'SF',
    time:'Tomorrow 11:00 AM',therapy:'Beauty Drip',                   addons:['Glutathione Push','Biotin IM'],
    total:385, status:'New Request',     source:'Instagram', priority:null,
    intake:'Pending', consent:'Pending', gfe:'Not Started', nurse:'Unassigned', payment:'Pending',
    guests:1, notes:'', created:'12:10 PM' },
  { id:'r8', client:'James Okafor', phone:'(415) 555-1005', email:'james.okafor@gmail.com',
    locationType:'home',   address:'2345 Telegraph Ave',               city:'Oakland',
    time:'Today 7:00 PM',  therapy:'Performance Drip + NAD+ IM',      addons:['NAD+ IM'],
    total:330, status:'New Request',     source:'Instagram', priority:null,
    intake:'Pending', consent:'Pending', gfe:'Not Started', nurse:'Unassigned', payment:'Pending',
    guests:2, notes:'Post-game recovery. 2 guests.', created:'1:22 PM' },
];

const NURSES = [
  { id:'n1', name:'Stephanie R.', status:'Assigned',  area:'SF Downtown / SoMa',          visits:2, kit:'Ready',           phone:'(415) 555-0102', assigned:['Serena W. — 3:00 PM','Alex Chen — 5:00 PM'] },
  { id:'n2', name:'Marcus T.',    status:'Assigned',  area:'Mission / Castro / Noe Valley',visits:1, kit:'Ready',           phone:'(415) 555-0103', assigned:['Maya Patel — 6:30 PM'] },
  { id:'n3', name:'Rachel K.',    status:'Available', area:'Marina / Pacific Heights',     visits:0, kit:'Ready',           phone:'(415) 555-0104', assigned:[] },
  { id:'n4', name:'Jordan M.',    status:'Available', area:'Oakland / Berkeley / East Bay', visits:0, kit:'Restock Needed', phone:'(415) 555-0105', assigned:[] },
  { id:'n5', name:'Priya K.',     status:'Off Duty',  area:'South Bay / Peninsula',        visits:0, kit:'Not Set',         phone:'(415) 555-0106', assigned:[] },
];

const CLEARANCE_ITEMS = [
  { id:'cl1', client:'Alex Chen',    therapy:"Myers + NAD+",   intake:'Done',    consent:'Done',    gfe:'Pending',     flag:'High dose — MD review required',  status:'GFE Pending' },
  { id:'cl2', client:'Priya Sharma', therapy:'Hydration',      intake:'Pending', consent:'Pending', gfe:'Not Started', flag:null,                               status:'Intake Pending' },
  { id:'cl3', client:'Tyler Brooks', therapy:'Energy Drip',    intake:'Done',    consent:'Pending', gfe:'Pending',     flag:'Group booking — 3 guests',         status:'Consent Pending' },
  { id:'cl4', client:'Sofia Reyes',  therapy:'Beauty Drip',    intake:'Pending', consent:'Pending', gfe:'Not Started', flag:null,                               status:'Intake Pending' },
];

const PAYMENTS = [
  { id:'p1', client:'Serena W.',    amount:450, status:'Paid',      method:'Card on file',      date:'Today',     invoice:'AV-0041' },
  { id:'p2', client:'Alex Chen',    amount:600, status:'Pending',   method:'Link not sent',     date:'Today',     invoice:'AV-0042' },
  { id:'p3', client:'Maya Patel',   amount:250, status:'Link Sent', method:'Square link',       date:'Today',     invoice:'AV-0043' },
  { id:'p4', client:'Tyler Brooks', amount:825, status:'Invoice',   method:'Corporate billing', date:'Net 30',    invoice:'AV-0044' },
  { id:'p5', client:'David Nguyen', amount:200, status:'Overdue',   method:'Zelle pending',     date:'5 days ago',invoice:'AV-0035' },
  { id:'p6', client:'Rachel Kim',   amount:260, status:'Paid',      method:'Venmo',             date:'May 8',     invoice:'AV-0039' },
];

const FOLLOWUPS = [
  { id:'f1', client:'Serena W.',    visitDate:'Today',  type:'Review Request',     priority:'High', note:'VIP — request Google + Yelp review post-visit' },
  { id:'f2', client:'Alex Chen',    visitDate:'May 8',  type:'Membership Upsell',  priority:'High', note:'9 visits — pitch Elite plan this week' },
  { id:'f3', client:'Marcus Lee',   visitDate:'Mar 18', type:'Rebook Prompt',      priority:'Med',  note:'54 days since last visit — send check-in' },
  { id:'f4', client:'Tyler Brooks', visitDate:'May 6',  type:'Post-Visit Check',   priority:'Med',  note:'Corporate client — confirm satisfaction' },
  { id:'f5', client:'David Nguyen', visitDate:'Open',   type:'Payment Follow-Up',  priority:'High', note:'Invoice AV-0035 overdue 5 days' },
  { id:'f6', client:'Sofia Reyes',  visitDate:'Today',  type:'Confirm New Request',priority:'Med',  note:'New request 12:10 PM — no contact yet' },
  { id:'f7', client:'James Okafor', visitDate:'Today',  type:'Confirm New Request',priority:'Med',  note:'New request 1:22 PM — no contact yet' },
  { id:'f8', client:'Priya Sharma', visitDate:'Today',  type:'Intake Reminder',    priority:'High', note:'Intake form incomplete — visit Today 4PM' },
  { id:'f9', client:'Noah Green',   visitDate:'Feb 12', type:'Rebook Prompt',      priority:'Low',  note:'Quiet since Feb — send check-in' },
];

const MEMBERSHIPS = [
  { id:'m1', client:'Alex Chen',    plan:'Elite',    status:'Interested',          sessions:9,  note:'Ready to commit — close this week' },
  { id:'m2', client:'Sofia Reyes',  plan:'Revive',   status:'Active Placeholder',  sessions:14, note:'Manual tracking — billing not yet configured' },
  { id:'m3', client:'David Nguyen', plan:'Recharge', status:'Interested',          sessions:8,  note:'Price-sensitive — offer loyalty discount' },
  { id:'m4', client:'Rachel Kim',   plan:'Revive',   status:'Active Placeholder',  sessions:6,  note:'Manual tracking — billing not yet configured' },
  { id:'m5', client:'New Inquiry',  plan:'Custom',   status:'New',                 sessions:0,  note:'Website form — contacted via Instagram DM' },
];

const EVENTS_LEADS = [
  { id:'e1', org:'Salesforce Summit',type:'Corporate',contact:'Jennifer H.',date:'Jun 12',  guests:40,    value:'$8,000+',  status:'Proposal Needed' },
  { id:'e2', org:'Four Seasons SF',  type:'Hotel',    contact:'Marcus B.',  date:'Ongoing', guests:'N/A', value:'$2,000/mo',status:'Won' },
  { id:'e3', org:'TechCrunch SF',    type:'Event',    contact:'Lisa Y.',    date:'Jul 18',  guests:100,   value:'$12,000+', status:'Contacted' },
  { id:'e4', org:'Equinox SoMa',     type:'Corporate',contact:'Ryan K.',    date:'Ongoing', guests:20,    value:'$3,500/mo',status:'Follow-Up' },
  { id:'e5', org:'SF Marathon',      type:'Event',    contact:'Dana M.',    date:'Oct 20',  guests:200,   value:'$20,000+', status:'New' },
];

const INVENTORY = [
  { id:'i1', name:'Nurse Bags',       status:'Ready',          detail:'4 of 4 kitted',  note:'' },
  { id:'i2', name:'IV Bags (1L)',      status:'Low Stock',      detail:'12 remaining',    note:'Reorder from Bound Tree' },
  { id:'i3', name:'NAD+ (250mg)',      status:'Ready',          detail:'8 vials',         note:'' },
  { id:'i4', name:'Glutathione 600mg', status:'Ready',          detail:'14 vials',        note:'' },
  { id:'i5', name:'Vitamin C (50ml)',  status:'Restock Needed', detail:'3 remaining',     note:'Order this week' },
  { id:'i6', name:'B-Complex',         status:'Ready',          detail:'Adequate',        note:'' },
  { id:'i7', name:'CBD (33mg)',         status:'Check Expiry',  detail:'6 vials',         note:'Exp. Jun 2026' },
  { id:'i8', name:'IM Shot Kit',        status:'Ready',         detail:'Stocked',         note:'' },
];

const ACTIVITY = [
  { id:'a1', text:'Serena W. marked Ready for Visit',       time:'1 min ago',  type:'success' },
  { id:'a2', text:'Payment received · Rachel Kim · $260',   time:'18 min ago', type:'payment' },
  { id:'a3', text:'Marcus T. assigned to Maya Patel',       time:'34 min ago', type:'nurse'   },
  { id:'a4', text:'New request — James Okafor · Instagram', time:'1h ago',     type:'new'     },
  { id:'a5', text:'Intake received — Priya Sharma',         time:'2h ago',     type:'intake'  },
  { id:'a6', text:'New request — Sofia Reyes · Instagram',  time:'2h ago',     type:'new'     },
  { id:'a7', text:'GFE pending flagged — Alex Chen',        time:'3h ago',     type:'alert'   },
];

// ─── Primitive components ─────────────────────────────────────────────────────

function StatusPill({ status, small }) {
  const { cls, dot } = pill(status);
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full font-body font-semibold whitespace-nowrap ${small ? 'text-[8px] px-1.5 py-0.5 tracking-[0.1em]' : 'text-[9px] px-2 py-0.5 tracking-[0.12em]'} uppercase ${cls}`}>
      <span className={`w-1 h-1 rounded-full shrink-0 ${dot}`} />
      {status}
    </span>
  );
}

function MicroCheck({ done, label }) {
  return (
    <div className={`flex items-center gap-1 ${done ? 'text-emerald-400' : 'text-foreground/35'}`}>
      {done
        ? <CheckCircle className="w-3 h-3 shrink-0" strokeWidth={2} />
        : <AlertCircle  className="w-3 h-3 shrink-0" strokeWidth={2} />}
      <span className="font-body text-[9px] tracking-[0.08em] uppercase">{label}</span>
    </div>
  );
}

function QuickBtn({ icon: Icon, label, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-body text-[10px] tracking-[0.12em] uppercase font-semibold border transition-all active:scale-95 ${
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
    <div className={`rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-2 px-1">
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
    <div className={`flex flex-col gap-1.5 p-3.5 rounded-2xl border shrink-0 ${urgent ? 'border-red-500/30 bg-red-500/[0.06]' : 'border-foreground/[0.08] bg-foreground/[0.03]'} min-w-[104px]`}>
      <div className={`flex items-center gap-1.5 ${urgent ? 'text-red-400' : 'text-foreground/45'}`}>
        <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
        <span className={`font-body text-[9px] tracking-[0.1em] uppercase whitespace-nowrap ${urgent ? 'text-red-400' : 'text-foreground/50'}`}>{label}</span>
      </div>
      <span className={`font-heading text-2xl leading-none ${urgent ? 'text-red-300' : 'text-foreground'}`}>{value}</span>
      {sub && <span className="font-body text-[9px] text-foreground/40 whitespace-nowrap">{sub}</span>}
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
  const risks = [
    { label:'2 visits need clinical clearance', level:'red' },
    { label:'4 visits unassigned nurse',         level:'red' },
    { label:'3 payments pending',                level:'amber' },
    { label:'1 kit needs restock before visits', level:'amber' },
  ];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" strokeWidth={2} />
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/40">Launch Risks · Today</p>
      </div>
      <div className="space-y-2">
        {risks.map((r, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.level === 'red' ? 'bg-red-400' : 'bg-amber-400'}`} />
            <span className="font-body text-xs text-foreground/70">{r.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
const ACT_COLORS = {
  success: 'bg-emerald-400', payment: 'bg-blue-400', nurse: 'bg-teal-400',
  new: 'bg-accent', intake: 'bg-amber-400', alert: 'bg-red-400',
};

function ActivityFeed() {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <SectionLabel>Activity Feed</SectionLabel>
      </div>
      <div className="divide-y divide-foreground/[0.05]">
        {ACTIVITY.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ACT_COLORS[a.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs text-foreground/75 leading-snug">{a.text}</p>
              <p className="font-body text-[9px] text-foreground/35 mt-0.5">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────
function RequestCard({ req, onOpen }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <button
        type="button"
        onClick={() => onOpen(req)}
        className="w-full text-left"
      >
        <Card className="p-4 active:bg-foreground/[0.06] transition-colors">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <LocIcon type={req.locationType} className="w-4 h-4 text-foreground/40 shrink-0" />
              <div className="min-w-0">
                <p className="font-body text-sm font-semibold text-foreground leading-tight">{req.client}</p>
                <p className="font-body text-[10px] text-foreground/40 truncate">{req.address}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {req.priority && (
                <span className="font-body text-[8px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-accent/40 text-accent bg-accent/10">
                  {req.priority}
                </span>
              )}
              <StatusPill status={req.status} small />
            </div>
          </div>

          {/* Visit info */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1 text-foreground/50">
              <Clock className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              <span className="font-body text-[10px]">{req.time}</span>
            </div>
            <div className="flex items-center gap-1 text-foreground/50">
              <FlaskConical className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              <span className="font-body text-[10px] truncate max-w-[120px]">{req.therapy}</span>
            </div>
            <div className="flex items-center gap-1 text-foreground/50">
              <DollarSign className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              <span className="font-body text-[10px]">${req.total}</span>
            </div>
          </div>

          {/* Progress row */}
          <div className="flex items-center gap-2 mb-3">
            <MicroCheck done={req.intake === 'Done'}   label="Intake"   />
            <MicroCheck done={req.consent === 'Done'}  label="Consent"  />
            <MicroCheck done={req.gfe === 'Cleared'}   label="Cleared"  />
            <MicroCheck done={req.nurse !== 'Unassigned'} label="Nurse" />
            <MicroCheck done={req.payment === 'Paid'}  label="Paid"     />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-body text-[9px] text-foreground/30 tracking-[0.1em] uppercase">{req.source}</span>
              <span className="text-foreground/20">·</span>
              <span className="font-body text-[9px] text-foreground/30">{req.created}</span>
            </div>
            {req.nurse !== 'Unassigned' ? (
              <span className="font-body text-[9px] text-teal-400">{req.nurse}</span>
            ) : (
              <span className="font-body text-[9px] text-orange-400/70">No nurse yet</span>
            )}
          </div>
        </Card>
      </button>
    </motion.div>
  );
}

// ─── Visit Detail Sheet ───────────────────────────────────────────────────────
const VISIT_STATUSES = [
  'New Request','Contacted','Confirmed','Intake Pending','Consent Pending',
  'GFE Pending','Cleared','Nurse Assigned','Payment Pending','Ready for Visit',
  'Completed','Follow-Up Due','Cancelled',
];

function VisitDetailSheet({ req, onClose }) {
  const [status, setStatus] = useState(req.status);
  const [note, setNote] = useState(req.notes || '');
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  return (
    <motion.div
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

      <div className="relative bg-[#0d0d0d] border-t border-foreground/[0.1] rounded-t-3xl flex flex-col overflow-hidden">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4 border-b border-foreground/[0.06] shrink-0">
          <div>
            <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-1">Visit Detail</p>
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
            className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/50">
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
                  <Icon className="w-3 h-3 text-foreground/35 shrink-0" strokeWidth={1.5} />
                  <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35">{label}</p>
                </div>
                <p className="font-body text-xs text-foreground/80 truncate">{val}</p>
              </div>
            ))}
          </div>

          {/* Address */}
          <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3">
            <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35 mb-1">Address</p>
            <p className="font-body text-xs text-foreground/80">{req.address}</p>
          </div>

          {/* Therapy */}
          <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3">
            <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35 mb-1.5">Therapy</p>
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
                  <div key={label} className={`rounded-xl border px-3 py-2.5 ${ok ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-orange-500/20 bg-orange-500/[0.04]'}`}>
                    <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35 mb-1">{label}</p>
                    <div className={`flex items-center gap-1.5 ${ok ? 'text-emerald-400' : 'text-orange-400'}`}>
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
              <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35 mb-1">Estimated Total</p>
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
                        onClick={() => { setStatus(s); setStatusOpen(false); }}
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
                <span className="font-body text-sm text-foreground/70">{req.nurse}</span>
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
          <div>
            <SectionLabel>Internal Notes</SectionLabel>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add notes..."
              className="w-full rounded-xl border border-foreground/15 bg-foreground/[0.03] px-4 py-3 font-body text-xs text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/35 resize-none"
            />
          </div>

          {/* Placeholder notice */}
          <div className="rounded-xl border border-foreground/[0.06] px-4 py-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <p className="font-body text-[9px] tracking-[0.1em] text-foreground/35 uppercase">
              Manual Fulfillment Mode · Changes saved locally
            </p>
          </div>
        </div>

        {/* Action bar */}
        <div className="px-5 pt-3 pb-5 border-t border-foreground/[0.06] space-y-2 shrink-0"
             style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
            <QuickBtn icon={MessageSquare} label="Text Client"   />
            <QuickBtn icon={Syringe}       label="Assign Nurse"  />
            <QuickBtn icon={Shield}        label="Mark Cleared"  />
            <QuickBtn icon={CreditCard}    label="Mark Paid"     />
            <QuickBtn icon={CheckCircle}   label="Complete"      accent />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Command Screen ───────────────────────────────────────────────────────────
function CommandScreen({ onSelectRequest }) {
  const tiles = [
    { icon: Plus,          value: '8',    label: 'New Requests',   sub: '2 same-day',      urgent: false },
    { icon: Clock,         value: '5',    label: 'Pending Confirm',sub: 'awaiting reply',  urgent: false },
    { icon: Calendar,      value: '3',    label: 'Visits Today',   sub: 'in 6h window',    urgent: false },
    { icon: Shield,        value: '4',    label: 'Need Clearance', sub: '1 flagged',       urgent: true  },
    { icon: Users,         value: '4',    label: 'Nurses Avail.',  sub: '2 assigned',      urgent: false },
    { icon: DollarSign,    value: '$660', label: 'Pmt Pending',    sub: '1 overdue',       urgent: true  },
    { icon: AlertCircle,   value: '9',    label: 'Follow-Ups Due', sub: '3 high priority', urgent: false },
    { icon: TrendingUp,    value:'$1,280',label: 'Revenue Today',  sub: '3 completed',     urgent: false },
  ];

  const urgent = REQUESTS.filter(r => ['GFE Pending','Intake Pending','New Request'].includes(r.status));

  return (
    <div className="space-y-5 pb-6">
      {/* Metrics strip */}
      <div className="-mx-4 px-4 flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
        {tiles.map((t) => (
          <StatusTile key={t.label} {...t} />
        ))}
      </div>

      {/* Risk card */}
      <RiskCard />

      {/* Needs action now */}
      <div>
        <SectionLabel>Needs Action Now</SectionLabel>
        <div className="space-y-2.5">
          {urgent.slice(0, 3).map((r) => (
            <RequestCard key={r.id} req={r} onOpen={onSelectRequest} />
          ))}
        </div>
      </div>

      {/* Activity feed */}
      <ActivityFeed />

      {/* Manual fulfillment banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02]">
        <Flame className="w-4 h-4 text-accent shrink-0" strokeWidth={1.5} />
        <div>
          <p className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/40">SF Bay Area · Manual Fulfillment Mode</p>
          <p className="font-body text-[10px] text-foreground/55 mt-0.5">All scheduling, assignment, and payment tracked manually during launch.</p>
        </div>
      </div>
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
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-3 px-1">
          Request Queue · {REQUESTS.length} total
        </p>
        <FilterChips options={REQ_FILTERS} active={filter} onChange={setFilter} />
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-body text-sm text-foreground/30">No requests in this filter</p>
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
            <ChevronDown className={`w-4 h-4 text-foreground/30 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
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
                  <p className="font-body text-[8px] text-foreground/35 tracking-[0.15em] uppercase">Visits</p>
                </div>
                <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-2.5 text-center col-span-2">
                  <p className="font-body text-[9px] text-foreground/55">{nurse.kit}</p>
                  <p className="font-body text-[8px] text-foreground/35 tracking-[0.15em] uppercase mt-0.5">Kit Status</p>
                </div>
              </div>
              {nurse.assigned.length > 0 && (
                <div>
                  <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35 mb-1.5">Assigned Today</p>
                  {nurse.assigned.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5">
                      <span className="w-1 h-1 rounded-full bg-teal-400 shrink-0" />
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
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 px-1">
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
function ClearanceScreen({ onSelectRequest }) {
  const [filter, setFilter] = useState('All');
  const filters = ['All','Intake Pending','Consent Pending','GFE Pending','Cleared'];
  const items = filter === 'All' ? CLEARANCE_ITEMS : CLEARANCE_ITEMS.filter(c => c.status === filter);

  return (
    <div className="space-y-4 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-3 px-1">
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
  const PAY_STATUS_COLOR = {
    Paid: 'text-emerald-400', 'Link Sent': 'text-blue-400',
    Invoice: 'text-amber-400', Pending: 'text-orange-400', Overdue: 'text-red-400',
  };
  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between px-1">
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35">Payments · Manual Tracking</p>
        <span className="font-body text-[9px] text-amber-400 tracking-[0.1em] uppercase border border-amber-400/30 px-2 py-0.5 rounded-full">
          Manual Mode
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-3 text-center">
          <p className="font-heading text-2xl text-foreground">$1,280</p>
          <p className="font-body text-[8px] tracking-[0.15em] uppercase text-foreground/35 mt-0.5">Collected</p>
        </div>
        <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.04] p-3 text-center">
          <p className="font-heading text-2xl text-orange-300">$660</p>
          <p className="font-body text-[8px] tracking-[0.15em] uppercase text-orange-400/60 mt-0.5">Pending</p>
        </div>
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-3 text-center">
          <p className="font-heading text-2xl text-red-300">$200</p>
          <p className="font-body text-[8px] tracking-[0.15em] uppercase text-red-400/60 mt-0.5">Overdue</p>
        </div>
      </div>
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
        <p className="font-body text-[9px] text-foreground/35 tracking-[0.1em] uppercase">
          Payment handled manually during launch. Square links sent via text or email.
        </p>
      </div>
    </div>
  );
}

// ─── Follow-Ups Screen ────────────────────────────────────────────────────────
const PRIORITY_COLOR = { High: 'text-red-400 border-red-500/25 bg-red-500/[0.06]', Med: 'text-amber-400 border-amber-500/25 bg-amber-500/[0.06]', Low: 'text-foreground/40 border-foreground/10 bg-foreground/[0.02]' };

function FollowUpsScreen() {
  const [filter, setFilter] = useState('All');
  const filters = ['All','High','Med','Low'];
  const items = filter === 'All' ? FOLLOWUPS : FOLLOWUPS.filter(f => f.priority === filter);
  return (
    <div className="space-y-4 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 px-1">Follow-Up Queue · {FOLLOWUPS.length} due</p>
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

// ─── Memberships Screen ───────────────────────────────────────────────────────
function MembershipsScreen() {
  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between px-1">
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35">Membership Leads</p>
        <span className="font-body text-[9px] text-amber-400 tracking-[0.1em] uppercase border border-amber-400/30 px-2 py-0.5 rounded-full">
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
const EVENT_TYPE_COLOR = { Hotel:'text-teal-400', Corporate:'text-blue-400', Event:'text-purple-400', Venue:'text-amber-400' };

function EventsScreen() {
  return (
    <div className="space-y-4 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 px-1">B2B / Event Leads</p>
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
const INV_COLOR = { Ready:'text-emerald-400', 'Low Stock':'text-amber-400', 'Restock Needed':'text-red-400', 'Check Expiry':'text-orange-400', 'Not Set':'text-foreground/35' };

function InventoryScreen() {
  return (
    <div className="space-y-4 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 px-1">Kit & Supply Status</p>
      <div className="grid grid-cols-2 gap-2.5">
        {INVENTORY.map((item) => (
          <Card key={item.id} className="p-4">
            <p className={`font-body text-[8px] tracking-[0.2em] uppercase font-semibold mb-1.5 ${INV_COLOR[item.status] || 'text-foreground/40'}`}>
              {item.status}
            </p>
            <p className="font-body text-sm font-semibold text-foreground leading-tight mb-0.5">{item.name}</p>
            <p className="font-body text-[10px] text-foreground/40">{item.detail}</p>
            {item.note && (
              <p className="font-body text-[9px] text-orange-400/70 mt-1.5 leading-snug">{item.note}</p>
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
    { label:'Membership Interest',value:'5 leads',sub:'2 ready to close' },
    { label:'Avg Ticket',         value:'$280',  sub:'Per completed visit' },
  ];
  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between px-1">
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35">Weekly Snapshot</p>
        <span className="font-body text-[9px] text-foreground/35 tracking-[0.1em] uppercase">Manual Estimates</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35 mb-1.5">{s.label}</p>
            <p className="font-heading text-2xl text-foreground leading-none">{s.value}</p>
            <p className="font-body text-[9px] text-foreground/35 mt-1">{s.sub}</p>
          </Card>
        ))}
      </div>
      <div className="rounded-xl border border-foreground/[0.06] px-4 py-3">
        <p className="font-body text-[9px] text-foreground/35 tracking-[0.1em] uppercase">
          Automation Placeholder · Analytics integration launches post-beta.
        </p>
      </div>
    </div>
  );
}

// ─── More Menu Sheet ──────────────────────────────────────────────────────────
const MORE_NAV = [
  { screen:'payments',    icon: CreditCard,   label: 'Payments',          href: null           },
  { screen:'followups',   icon: Heart,        label: 'Follow-Ups',        href: null           },
  { screen:'memberships', icon: Star,         label: 'Memberships',       href: null           },
  { screen:'events',      icon: Calendar,     label: 'Events / B2B',      href: null           },
  { screen:'inventory',   icon: Package,      label: 'Avalon Inventory',  href: '/admin/inventory' },
  { screen:'reports',     icon: TrendingUp,   label: 'Reports',           href: null           },
];

function MoreMenuSheet({ onClose, onNav, onSignOut }) {
  return (
    <motion.div
      initial={{ y:'100%' }} animate={{ y: 0 }} exit={{ y:'100%' }}
      transition={{ duration: 0.38, ease: EASE }}
      className="fixed inset-x-0 bottom-0 z-50 bg-[#0d0d0d] border-t border-foreground/[0.1] rounded-t-3xl"
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
          className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/50">
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
              <ChevronRight className="w-4 h-4 text-foreground/25 ml-auto" strokeWidth={1.5} />
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
  { screen:'command',   icon: LayoutDashboard, label: 'Command'   },
  { screen:'requests',  icon: ClipboardList,   label: 'Requests'  },
  { screen:'nurses',    icon: Users,           label: 'Nurses'    },
  { screen:'clearance', icon: Shield,          label: 'Clearance' },
];

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Command() {
  const { signOut }                        = useAuthStore();
  const navigate                           = useNavigate();
  const { cycle: cycleTheme, Icon: ThemeIcon } = useAdminTheme();
  const [screen, setScreen]               = useState('command');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [moreOpen, setMoreOpen]           = useState(false);

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  const screenTitles = {
    command:     'AVALON OS',
    requests:    'REQUEST QUEUE',
    nurses:      'NURSE BOARD',
    clearance:   'CLEARANCE',
    payments:    'PAYMENTS',
    followups:   'FOLLOW-UPS',
    memberships: 'MEMBERSHIPS',
    events:      'EVENTS / B2B',
    inventory:   'INVENTORY',
    reports:     'REPORTS',
  };

  const isMoreScreen = !BOTTOM_NAV.find(n => n.screen === screen);
  const isMainNav = BOTTOM_NAV.find(n => n.screen === screen);

  return (
    <div className="h-screen bg-background text-foreground flex flex-col max-w-[430px] mx-auto overflow-hidden" style={{ height: '100dvh' }}>

      {/* ── Top Bar — shrink-0 so it never flexes away; no sticky needed in fixed-height flex-col ── */}
      <div className="shrink-0 bg-background border-b border-foreground/[0.06]">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            {isMoreScreen && (
              <button type="button" onClick={() => setScreen('command')}
                className="w-7 h-7 flex items-center justify-center text-foreground/50 hover:text-foreground">
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-[13px] tracking-[0.35em] text-foreground">AV</span>
              </div>
              <p className="font-body text-[8px] tracking-[0.15em] uppercase text-foreground/35 mt-0.5">{TODAY_LABEL}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button"
              className="relative w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/50">
              <Bell className="w-4 h-4" strokeWidth={1.5} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-400" />
            </button>
            <button type="button" onClick={cycleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/60 hover:text-foreground transition-colors"
              aria-label="Cycle theme">
              <ThemeIcon className="w-4 h-4" />
            </button>
            <button type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/50">
              <User className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Screen title */}
        <div className="px-4 pb-2">
          <h1 className="font-heading text-2xl text-foreground uppercase leading-none tracking-tight">
            {screenTitles[screen]}
          </h1>
        </div>
      </div>

      {/* ── Screen Content ──────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 pt-1.5" style={{ paddingBottom:'5.5rem' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            {screen === 'command'     && <CommandScreen   onSelectRequest={setSelectedRequest} />}
            {screen === 'requests'    && <RequestsScreen  onSelectRequest={setSelectedRequest} />}
            {screen === 'nurses'      && <NursesScreen />}
            {screen === 'clearance'   && <ClearanceScreen onSelectRequest={setSelectedRequest} />}
            {screen === 'payments'    && <PaymentsScreen />}
            {screen === 'followups'   && <FollowUpsScreen />}
            {screen === 'memberships' && <MembershipsScreen />}
            {screen === 'events'      && <EventsScreen />}
            {screen === 'inventory'   && <InventoryScreen />}
            {screen === 'reports'     && <ReportsScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Bottom Nav ──────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 bg-background border-t border-foreground/[0.12] max-w-[430px] mx-auto"
        style={{ paddingBottom:'max(env(safe-area-inset-bottom), 0px)' }}
      >
        <div className="flex items-stretch">
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
                {/* Badge for requests */}
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

      {/* ── Visit Detail Sheet ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedRequest && (
          <VisitDetailSheet
            req={selectedRequest}
            onClose={() => setSelectedRequest(null)}
          />
        )}
      </AnimatePresence>

      {/* ── More Menu Sheet ──────────────────────────────────────── */}
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
