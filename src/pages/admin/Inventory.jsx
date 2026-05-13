import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Package, RefreshCw, MoreHorizontal, LayoutDashboard,
  AlertTriangle, AlertCircle, CheckCircle, Clock, X, Plus, Minus,
  ChevronDown, ChevronRight, ArrowLeft, Search,
  Shield, Zap, Droplets, FlaskConical, Syringe, Sparkles,
  User, Calendar, Edit3, FolderOpen, Tag,
  QrCode, FileText, BarChart3, Settings, Activity,
  Box, Hash, Thermometer, LogOut, Bell, Archive,
  BriefcaseMedical, Star, TrendingUp, MoveRight,
} from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];
const TODAY_STR = '2026-05-12';
const TODAY_LABEL = 'Tue · May 12';

// ─── Expiry logic ─────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date(TODAY_STR)) / 86400000);
  return diff;
}
function expiryStatus(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return null;
  if (d <= 0)  return 'Expired';
  if (d <= 7)  return 'Critical';
  if (d <= 14) return 'Urgent';
  if (d <= 30) return 'Warning';
  return 'OK';
}
function stockStatus(qty, restockThreshold, parLevel) {
  if (qty <= 0)              return 'Out of Stock';
  if (qty <= restockThreshold) return 'Restock Needed';
  if (qty <= parLevel * 0.5)   return 'Low Stock';
  return 'Ready';
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  'Ready':          { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  'Low Stock':      { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25',       dot: 'bg-amber-400'   },
  'Restock Needed': { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    dot: 'bg-orange-400'  },
  'Out of Stock':   { cls: 'bg-red-500/15 text-red-300 border-red-500/25',             dot: 'bg-red-400'     },
  'Expiring Soon':  { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25',       dot: 'bg-amber-400'   },
  'Expired':        { cls: 'bg-red-900/20 text-red-400/70 border-red-900/30',          dot: 'bg-red-700'     },
  'Quarantine':     { cls: 'bg-red-900/20 text-red-400/70 border-red-900/30',          dot: 'bg-red-700'     },
  'Assigned':       { cls: 'bg-teal-500/15 text-teal-300 border-teal-500/25',          dot: 'bg-teal-400'    },
  'In Use':         { cls: 'bg-blue-500/15 text-blue-300 border-blue-500/25',          dot: 'bg-blue-400'    },
  'Returned':       { cls: 'bg-foreground/8 text-foreground/45 border-foreground/10',  dot: 'bg-foreground/30'},
  'Missing':        { cls: 'bg-red-500/15 text-red-300 border-red-500/25',             dot: 'bg-red-400'     },
  // Kit statuses
  'Kit Ready':      { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
  'Needs Restock':  { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    dot: 'bg-orange-400'  },
  'Missing Items':  { cls: 'bg-red-500/15 text-red-300 border-red-500/25',             dot: 'bg-red-400'     },
  'Check Expiry':   { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25',       dot: 'bg-amber-400'   },
  'Needs Count':    { cls: 'bg-foreground/8 text-foreground/45 border-foreground/10',  dot: 'bg-foreground/30'},
  // Expiry statuses
  'Critical':       { cls: 'bg-red-500/15 text-red-300 border-red-500/25',             dot: 'bg-red-400'     },
  'Urgent':         { cls: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    dot: 'bg-orange-400'  },
  'Warning':        { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25',       dot: 'bg-amber-400'   },
  'OK':             { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', dot: 'bg-emerald-400' },
};
function pill(s) {
  return STATUS_CFG[s] || { cls: 'bg-foreground/8 text-foreground/50 border-foreground/10', dot: 'bg-foreground/30' };
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const ITEMS_RAW = [
  { id:'iv1',  name:'IV Bag — 1L Normal Saline', sku:'IV-NS-1L',    category:'IV',        qty:12, unit:'bags',    parLevel:20, restockThreshold:8,  location:'SF Hub › IV Supplies',  lotNumber:'LS240412', expirationDate:'2026-09-15', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Bound Tree Medical', cost:4.50,  notes:'Reorder from Bound Tree. Min order 24.',         qrCode:'AV-IV-NS-1L-001'  },
  { id:'iv2',  name:'IV Start Kit',              sku:'IV-SK-STD',   category:'IV',        qty:6,  unit:'kits',    parLevel:12, restockThreshold:4,  location:'SF Hub › IV Supplies',  lotNumber:'SK240508', expirationDate:'2027-03-01', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Bound Tree Medical', cost:8.75,  notes:'Includes tourniquet, tegaderm, 20g catheter.',   qrCode:'AV-IV-SK-001'     },
  { id:'iv3',  name:'IV Extension Set (10")',    sku:'IV-EXT-10',   category:'IV',        qty:18, unit:'sets',    parLevel:20, restockThreshold:8,  location:'SF Hub › IV Supplies',  lotNumber:'ES240301', expirationDate:'2027-06-01', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Bound Tree Medical', cost:2.25,  notes:'',                                               qrCode:'AV-IV-EXT-001'    },
  { id:'rx1',  name:'NAD+ 250mg vial',           sku:'RX-NAD-250',  category:'Medication',qty:8,  unit:'vials',   parLevel:10, restockThreshold:3,  location:'SF Hub › Add-Ons',      lotNumber:'NAD240490', expirationDate:'2026-05-19', refrigeration:true,  controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:85.00, notes:'Refrigerate. Check expiry weekly.',               qrCode:'AV-NAD-250-001'   },
  { id:'rx2',  name:'Glutathione 600mg vial',    sku:'RX-GLU-600',  category:'Medication',qty:14, unit:'vials',   parLevel:16, restockThreshold:6,  location:'SF Hub › Add-Ons',      lotNumber:'GL240380', expirationDate:'2026-08-10', refrigeration:true,  controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:22.00, notes:'Refrigerate.',                                    qrCode:'AV-GLU-600-001'   },
  { id:'rx3',  name:'Vitamin C 50ml (50g/L)',    sku:'RX-VIC-50',   category:'Medication',qty:3,  unit:'vials',   parLevel:10, restockThreshold:4,  location:'SF Hub › Add-Ons',      lotNumber:'VC240210', expirationDate:'2026-06-05', refrigeration:true,  controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:18.50, notes:'Order this week.',                                qrCode:'AV-VIC-50-001'    },
  { id:'rx4',  name:'B-Complex vial',            sku:'RX-BCP-10',   category:'Medication',qty:22, unit:'vials',   parLevel:20, restockThreshold:8,  location:'SF Hub › IV Supplies',  lotNumber:'BC240101', expirationDate:'2026-12-01', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:9.00,  notes:'',                                               qrCode:'AV-BCP-001'       },
  { id:'rx5',  name:'Magnesium Sulfate vial',    sku:'RX-MAG-5',    category:'Medication',qty:16, unit:'vials',   parLevel:16, restockThreshold:6,  location:'SF Hub › IV Supplies',  lotNumber:'MG240210', expirationDate:'2026-11-15', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:7.50,  notes:'',                                               qrCode:'AV-MAG-001'       },
  { id:'rx6',  name:'CBD 33mg vial',             sku:'RX-CBD-33',   category:'Medication',qty:6,  unit:'vials',   parLevel:8,  restockThreshold:3,  location:'SF Hub › Add-Ons',      lotNumber:'CBD240310', expirationDate:'2026-06-01', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:45.00, notes:'Exp. Jun 2026 — check before use.',               qrCode:'AV-CBD-001'       },
  { id:'rx7',  name:'Ondansetron (Zofran) 4mg',  sku:'RX-ZOF-4',   category:'Medication',qty:20, unit:'vials',   parLevel:20, restockThreshold:8,  location:'SF Hub › IV Supplies',  lotNumber:'ZF240405', expirationDate:'2027-01-01', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:6.50,  notes:'',                                               qrCode:'AV-ZOF-001'       },
  { id:'im1',  name:'B12 IM vial (1000mcg/ml)',  sku:'IM-B12-1',    category:'IM',        qty:18, unit:'vials',   parLevel:20, restockThreshold:8,  location:'SF Hub › IM Supplies',  lotNumber:'B12240501', expirationDate:'2027-02-15', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:5.50,  notes:'',                                               qrCode:'AV-B12-001'       },
  { id:'im2',  name:'MIC Lipotropic IM vial',    sku:'IM-MIC-5',    category:'IM',        qty:12, unit:'vials',   parLevel:12, restockThreshold:4,  location:'SF Hub › IM Supplies',  lotNumber:'MC240402', expirationDate:'2026-09-20', refrigeration:true,  controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:14.00, notes:'Refrigerate.',                                    qrCode:'AV-MIC-001'       },
  { id:'im3',  name:'Biotin IM vial (10mg/ml)',  sku:'IM-BIO-10',   category:'IM',        qty:10, unit:'vials',   parLevel:10, restockThreshold:4,  location:'SF Hub › IM Supplies',  lotNumber:'BI240312', expirationDate:'2026-10-01', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:10.00, notes:'',                                               qrCode:'AV-BIO-001'       },
  { id:'im4',  name:'IM Syringe 3ml (23g)',      sku:'IM-SYR-3',    category:'IM',        qty:40, unit:'syringes',parLevel:40, restockThreshold:15, location:'SF Hub › IM Supplies',  lotNumber:'SY240501', expirationDate:'2028-01-01', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Bound Tree Medical', cost:0.85,  notes:'',                                               qrCode:'AV-SYR-IM-001'    },
  { id:'pp1',  name:'Nitrile Gloves — Lg (box)', sku:'PPE-GLV-LG',  category:'PPE',       qty:4,  unit:'boxes',   parLevel:6,  restockThreshold:2,  location:'SF Hub › PPE',          lotNumber:'GL240410', expirationDate:null,         refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'McKesson',           cost:12.00, notes:'',                                               qrCode:'AV-GLV-LG-001'    },
  { id:'pp2',  name:'N95 Mask',                  sku:'PPE-N95-STD', category:'PPE',       qty:24, unit:'masks',   parLevel:20, restockThreshold:8,  location:'SF Hub › PPE',          lotNumber:'N9240401', expirationDate:'2029-01-01', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'McKesson',           cost:2.50,  notes:'',                                               qrCode:'AV-N95-001'       },
  { id:'sh1',  name:'Sharps Container 1qt',      sku:'DIS-SHC-1',   category:'Sharps',    qty:8,  unit:'units',   parLevel:8,  restockThreshold:3,  location:'SF Hub › Sharps',       lotNumber:'SC240301', expirationDate:null,         refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'McKesson',           cost:4.75,  notes:'Do not overfill. Return for disposal.',           qrCode:'AV-SHC-001'       },
  { id:'em1',  name:'Epinephrine 1mg/ml (1ml)',  sku:'EM-EPI-1',    category:'Emergency', qty:4,  unit:'vials',   parLevel:4,  restockThreshold:2,  location:'SF Hub › Emergency',    lotNumber:'EP240505', expirationDate:'2026-05-18', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:32.00, notes:'Check expiry before each shift. Critical.',       qrCode:'AV-EPI-001'       },
  { id:'em2',  name:'Diphenhydramine 50mg vial', sku:'EM-DPH-50',   category:'Emergency', qty:6,  unit:'vials',   parLevel:6,  restockThreshold:2,  location:'SF Hub › Emergency',    lotNumber:'DH240405', expirationDate:'2027-03-15', refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Olympia Pharmacy',   cost:8.50,  notes:'Anaphylaxis protocol.',                           qrCode:'AV-DPH-001'       },
  { id:'dv1',  name:'Digital BP Cuff',           sku:'DEV-BP-DIG',  category:'Device',    qty:4,  unit:'units',   parLevel:4,  restockThreshold:2,  location:'SF Hub › Devices',      lotNumber:'BP240110', expirationDate:null,         refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Omron',              cost:65.00, notes:'Check battery before each shift.',                qrCode:'AV-BP-001'        },
  { id:'dv2',  name:'Pulse Oximeter',            sku:'DEV-POX-STD', category:'Device',    qty:4,  unit:'units',   parLevel:4,  restockThreshold:2,  location:'SF Hub › Devices',      lotNumber:'PO240110', expirationDate:null,         refrigeration:false, controlled:false, assignedNurse:null,       assignedEvent:null,             supplier:'Masimo',             cost:42.00, notes:'',                                               qrCode:'AV-POX-001'       },
];

// Augment items with computed status
const ITEMS = ITEMS_RAW.map(item => {
  const sStatus = stockStatus(item.qty, item.restockThreshold, item.parLevel);
  const eStatus = expiryStatus(item.expirationDate);
  let status = sStatus;
  if (status === 'Ready' && (eStatus === 'Critical' || eStatus === 'Urgent')) status = 'Expiring Soon';
  return { ...item, stockStatus: sStatus, expiryStatus: eStatus, status };
});

// ─── Folders ─────────────────────────────────────────────────────────────────
const FOLDERS = [
  { id:'f-iv',    name:'IV Supplies',    icon: Droplets,      parentId:'f-hub',    itemCount:7,  lowStock:2, expiring:1 },
  { id:'f-im',    name:'IM Supplies',    icon: Syringe,       parentId:'f-hub',    itemCount:4,  lowStock:0, expiring:0 },
  { id:'f-add',   name:'Add-Ons',        icon: Sparkles,      parentId:'f-hub',    itemCount:4,  lowStock:1, expiring:2 },
  { id:'f-ppe',   name:'PPE',            icon: Shield,        parentId:'f-hub',    itemCount:2,  lowStock:0, expiring:0 },
  { id:'f-em',    name:'Emergency',      icon: AlertTriangle, parentId:'f-hub',    itemCount:2,  lowStock:0, expiring:1 },
  { id:'f-sh',    name:'Sharps',         icon: Archive,       parentId:'f-hub',    itemCount:1,  lowStock:0, expiring:0 },
  { id:'f-dv',    name:'Devices',        icon: Zap,           parentId:'f-hub',    itemCount:2,  lowStock:0, expiring:0 },
  { id:'f-n-nik', name:'Nikki — Bag',    icon: BriefcaseMedical, parentId:'f-nurses', itemCount:12, lowStock:1, expiring:0 },
  { id:'f-n-ste', name:'Stephanie — Bag',icon: BriefcaseMedical, parentId:'f-nurses', itemCount:12, lowStock:2, expiring:1 },
  { id:'f-n-bkp', name:'Backup — Bag',   icon: BriefcaseMedical, parentId:'f-nurses', itemCount:12, lowStock:0, expiring:0 },
  { id:'f-ev-b2b',name:'Bay to Breakers',icon: Calendar,     parentId:'f-events', itemCount:18, lowStock:3, expiring:0 },
  { id:'f-ev-vi', name:'Vital Ice',       icon: Calendar,     parentId:'f-events', itemCount:14, lowStock:0, expiring:0 },
  { id:'f-rst',   name:'Low Stock',       icon: AlertCircle,  parentId:'f-review', itemCount:7,  lowStock:7, expiring:0 },
  { id:'f-exp',   name:'Expiring Soon',   icon: Clock,        parentId:'f-review', itemCount:3,  lowStock:0, expiring:3 },
];

const FOLDER_GROUPS = [
  { id:'f-hub',    label:'SF Hub',             icon:FolderOpen },
  { id:'f-nurses', label:'Assigned to Nurses', icon:User       },
  { id:'f-events', label:'Events',             icon:Calendar   },
  { id:'f-review', label:'Restock / Review',   icon:AlertTriangle },
];

// ─── Kits ─────────────────────────────────────────────────────────────────────
const KITS = [
  {
    id:'k1', name:'Nurse Bag — Nikki', kitType:'Nurse Bag', assignedNurse:'Nikki', assignedEvent:null,
    status:'Kit Ready', lastCheckedAt:'Today 8:30 AM', checkedBy:'Nikki',
    items: [
      { name:'IV Bag 1L NS',        required:4,  current:4,  unit:'bags',  ok:true  },
      { name:'IV Start Kit',        required:4,  current:4,  unit:'kits',  ok:true  },
      { name:'IV Extension Set',    required:4,  current:4,  unit:'sets',  ok:true  },
      { name:'B-Complex vial',      required:4,  current:4,  unit:'vials', ok:true  },
      { name:'Magnesium vial',      required:3,  current:3,  unit:'vials', ok:true  },
      { name:'Glutathione 600mg',   required:2,  current:2,  unit:'vials', ok:true  },
      { name:'IM Syringe 3ml',      required:6,  current:6,  unit:'syrs',  ok:true  },
      { name:'B12 IM vial',         required:3,  current:3,  unit:'vials', ok:true  },
      { name:'Gloves Lg (box)',      required:1,  current:1,  unit:'box',   ok:true  },
      { name:'Sharps Container',    required:1,  current:1,  unit:'unit',  ok:true  },
      { name:'Pulse Oximeter',      required:1,  current:1,  unit:'unit',  ok:true  },
      { name:'Digital BP Cuff',     required:1,  current:1,  unit:'unit',  ok:true  },
    ],
    blockers:[],
    notes:'Ready for 2 visits today.',
  },
  {
    id:'k2', name:'Nurse Bag — Stephanie', kitType:'Nurse Bag', assignedNurse:'Stephanie', assignedEvent:null,
    status:'Needs Restock', lastCheckedAt:'Today 7:45 AM', checkedBy:'Stephanie',
    items: [
      { name:'IV Bag 1L NS',        required:4,  current:2,  unit:'bags',  ok:false },
      { name:'IV Start Kit',        required:4,  current:3,  unit:'kits',  ok:false },
      { name:'IV Extension Set',    required:4,  current:4,  unit:'sets',  ok:true  },
      { name:'B-Complex vial',      required:4,  current:4,  unit:'vials', ok:true  },
      { name:'Magnesium vial',      required:3,  current:3,  unit:'vials', ok:true  },
      { name:'Glutathione 600mg',   required:2,  current:2,  unit:'vials', ok:true  },
      { name:'IM Syringe 3ml',      required:6,  current:4,  unit:'syrs',  ok:false },
      { name:'B12 IM vial',         required:3,  current:3,  unit:'vials', ok:true  },
      { name:'Gloves Lg (box)',      required:1,  current:1,  unit:'box',   ok:true  },
      { name:'Sharps Container',    required:1,  current:1,  unit:'unit',  ok:true  },
      { name:'Pulse Oximeter',      required:1,  current:1,  unit:'unit',  ok:true  },
      { name:'Digital BP Cuff',     required:1,  current:1,  unit:'unit',  ok:true  },
    ],
    blockers:['IV Bag 1L NS — 2 short','IV Start Kit — 1 short','IM Syringe — 2 short'],
    notes:'Needs restock before 3:00 PM visits.',
  },
  {
    id:'k3', name:'Nurse Bag — Backup', kitType:'Nurse Bag', assignedNurse:'Backup', assignedEvent:null,
    status:'Needs Count', lastCheckedAt:'May 9', checkedBy:'Joseph',
    items: [
      { name:'IV Bag 1L NS',        required:4,  current:4,  unit:'bags',  ok:true  },
      { name:'IV Start Kit',        required:4,  current:4,  unit:'kits',  ok:true  },
      { name:'B-Complex vial',      required:4,  current:4,  unit:'vials', ok:true  },
      { name:'Glutathione 600mg',   required:2,  current:2,  unit:'vials', ok:true  },
      { name:'B12 IM vial',         required:3,  current:3,  unit:'vials', ok:true  },
    ],
    blockers:['Count not verified in 3+ days'],
    notes:'Last count May 9. Verify before next activation.',
  },
  {
    id:'k4', name:'Event Kit — Bay to Breakers', kitType:'Event Kit', assignedNurse:'Joseph', assignedEvent:'Bay to Breakers',
    status:'Missing Items', lastCheckedAt:'May 10', checkedBy:'Joseph',
    items: [
      { name:'IV Bag 1L NS',        required:40, current:12, unit:'bags',  ok:false },
      { name:'IV Start Kit',        required:40, current:6,  unit:'kits',  ok:false },
      { name:'IV Extension Set',    required:40, current:18, unit:'sets',  ok:false },
      { name:'Gloves Lg (box)',      required:6,  current:4,  unit:'boxes', ok:false },
      { name:'Sharps Container',    required:6,  current:8,  unit:'units', ok:true  },
      { name:'Ondansetron 4mg',     required:20, current:20, unit:'vials', ok:true  },
      { name:'Epinephrine 1mg',     required:6,  current:4,  unit:'vials', ok:false },
    ],
    blockers:['IV Bags — 28 short','IV Start Kits — 34 short','Extension Sets — 22 short','Epi — 2 short'],
    notes:'Event Jun 12. Order must be placed by May 16.',
  },
  {
    id:'k5', name:'Event Kit — Vital Ice', kitType:'Event Kit', assignedNurse:'Rachel', assignedEvent:'Vital Ice',
    status:'Kit Ready', lastCheckedAt:'May 11', checkedBy:'Rachel',
    items: [
      { name:'IV Bag 1L NS',        required:20, current:20, unit:'bags',  ok:true  },
      { name:'IV Start Kit',        required:20, current:20, unit:'kits',  ok:true  },
      { name:'IV Extension Set',    required:20, current:20, unit:'sets',  ok:true  },
      { name:'Gloves Lg (box)',      required:3,  current:3,  unit:'boxes', ok:true  },
      { name:'Sharps Container',    required:3,  current:3,  unit:'units', ok:true  },
    ],
    blockers:[],
    notes:'Ready. Event May 18.',
  },
];

// ─── Restock queue ────────────────────────────────────────────────────────────
const RESTOCK = [
  { id:'rs1', itemId:'iv1', name:'IV Bag — 1L Normal Saline', category:'IV',        current:12, par:20, needed:8,  priority:'High',  supplier:'Bound Tree Medical', relatedKit:'Nurse Bag — Stephanie, Bay to Breakers', status:'Pending' },
  { id:'rs2', itemId:'iv2', name:'IV Start Kit',              category:'IV',        current:6,  par:12, needed:6,  priority:'High',  supplier:'Bound Tree Medical', relatedKit:'Bay to Breakers',                          status:'Pending' },
  { id:'rs3', itemId:'rx3', name:'Vitamin C 50ml',            category:'Medication',current:3,  par:10, needed:7,  priority:'High',  supplier:'Olympia Pharmacy',   relatedKit:null,                                       status:'Pending' },
  { id:'rs4', itemId:'rx6', name:'CBD 33mg vial',             category:'Medication',current:6,  par:8,  needed:2,  priority:'Med',   supplier:'Olympia Pharmacy',   relatedKit:null,                                       status:'Pending' },
  { id:'rs5', itemId:'iv3', name:'IV Extension Set',          category:'IV',        current:18, par:20, needed:2,  priority:'Med',   supplier:'Bound Tree Medical', relatedKit:'Bay to Breakers',                          status:'Pending' },
  { id:'rs6', itemId:'em1', name:'Epinephrine 1mg/ml',        category:'Emergency', current:4,  par:4,  needed:2,  priority:'High',  supplier:'Olympia Pharmacy',   relatedKit:'Bay to Breakers, All Nurse Bags',           status:'Pending' },
  { id:'rs7', itemId:'pp1', name:'Nitrile Gloves — Lg',       category:'PPE',       current:4,  par:6,  needed:2,  priority:'Low',   supplier:'McKesson',           relatedKit:null,                                       status:'Pending' },
];

// ─── Expiry queue ─────────────────────────────────────────────────────────────
const EXPIRY_ITEMS = ITEMS.filter(i => i.expirationDate && expiryStatus(i.expirationDate) !== 'OK' && expiryStatus(i.expirationDate) !== null)
  .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

// ─── Activity log ─────────────────────────────────────────────────────────────
const ACTIVITY_LOG = [
  { id:'al1', action:'Kit marked Ready',       item:'Nurse Bag — Nikki',         user:'Nikki',     time:'Today 8:30 AM',  type:'kit'      },
  { id:'al2', action:'Quantity adjusted -2',   item:'IV Bag 1L NS',              user:'Stephanie', time:'Today 7:45 AM',  type:'qty'      },
  { id:'al3', action:'Restock marked needed',  item:'Vitamin C 50ml',            user:'Joseph',    time:'Today 7:00 AM',  type:'restock'  },
  { id:'al4', action:'Expiry flagged',         item:'Epinephrine 1mg/ml',        user:'System',    time:'Yesterday',      type:'expiry'   },
  { id:'al5', action:'Kit checked',            item:'Event Kit — Vital Ice',     user:'Rachel',    time:'May 11',         type:'kit'      },
  { id:'al6', action:'Item added',             item:'IM Syringe 3ml × 40',       user:'Joseph',    time:'May 10',         type:'new'      },
  { id:'al7', action:'Low stock flagged',      item:'IV Start Kit',              user:'System',    time:'May 9',          type:'alert'    },
];

const ACT_DOT = { kit:'bg-emerald-400', qty:'bg-blue-400', restock:'bg-orange-400', expiry:'bg-amber-400', new:'bg-accent', alert:'bg-red-400' };

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

function Card({ children, className = '', onClick }) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`w-full text-left rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] active:bg-foreground/[0.06] transition-colors ${className}`}>
        {children}
      </button>
    );
  }
  return (
    <div className={`rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-2 px-1">{children}</p>;
}

function QuickBtn({ icon: Icon, label, accent, small, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl font-body tracking-[0.12em] uppercase font-semibold border transition-all active:scale-95 ${small ? 'px-2.5 py-1.5 text-[9px]' : 'px-3 py-2 text-[10px]'} ${accent ? 'bg-foreground text-background border-foreground' : 'border-foreground/15 text-foreground/70 hover:border-foreground/30'}`}>
      {Icon && <Icon className="w-3 h-3 shrink-0" strokeWidth={2} />}
      {label}
    </button>
  );
}

function MetricTile({ icon: Icon, value, label, sub, urgent }) {
  return (
    <div className={`flex flex-col gap-1.5 p-3.5 rounded-2xl border min-w-[84px] ${urgent ? 'border-red-500/30 bg-red-500/[0.06]' : 'border-foreground/[0.08] bg-foreground/[0.03]'}`}>
      <div className={`flex items-center gap-1.5 ${urgent ? 'text-red-400' : 'text-foreground/45'}`}>
        <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
        <span className={`font-body text-[8px] tracking-[0.2em] uppercase ${urgent ? 'text-red-400' : 'text-foreground/45'}`}>{label}</span>
      </div>
      <span className={`font-heading text-2xl leading-none ${urgent ? 'text-red-300' : 'text-foreground'}`}>{value}</span>
      {sub && <span className="font-body text-[9px] text-foreground/35">{sub}</span>}
    </div>
  );
}

function ExpiryBadge({ dateStr }) {
  if (!dateStr) return null;
  const d = daysUntil(dateStr);
  const st = expiryStatus(dateStr);
  if (st === 'OK') return null;
  const colors = { Critical:'text-red-300 bg-red-500/15 border-red-500/25', Urgent:'text-orange-300 bg-orange-500/15 border-orange-500/25', Warning:'text-amber-300 bg-amber-500/15 border-amber-500/25', Expired:'text-red-400 bg-red-900/20 border-red-900/30' };
  const label = d <= 0 ? 'EXPIRED' : `${d}d`;
  return <span className={`font-body text-[8px] tracking-[0.1em] px-1.5 py-0.5 rounded-full border font-semibold uppercase ${colors[st]}`}>{label}</span>;
}

function QuantityAdjuster({ qty, onAdd, onRemove }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onRemove}
        className="w-10 h-10 rounded-full border border-foreground/20 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors text-xl leading-none">−</button>
      <span className="font-heading text-3xl text-foreground w-12 text-center">{qty}</span>
      <button type="button" onClick={onAdd}
        className="w-10 h-10 rounded-full border border-foreground/20 flex items-center justify-center text-foreground/60 hover:text-foreground transition-colors text-xl leading-none">+</button>
    </div>
  );
}

function FilterChips({ options, active, onChange }) {
  return (
    <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`shrink-0 px-3.5 py-1.5 rounded-full font-body text-[9px] tracking-[0.15em] uppercase font-semibold border transition-all ${active === o ? 'bg-foreground text-background border-foreground' : 'border-foreground/15 text-foreground/50 hover:border-foreground/30'}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({ item, onOpen }) {
  const CategoryIcon = { IV: Droplets, Medication: FlaskConical, IM: Syringe, PPE: Shield, Emergency: AlertTriangle, Sharps: Archive, Device: Zap }[item.category] || Package;
  return (
    <Card onClick={() => onOpen(item)} className="p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="w-9 h-9 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
          <CategoryIcon className="w-4 h-4 text-foreground/50" strokeWidth={1.5} />
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusPill status={item.status} small />
          <ExpiryBadge dateStr={item.expirationDate} />
        </div>
      </div>
      <p className="font-body text-xs font-semibold text-foreground leading-tight mb-1 line-clamp-2">{item.name}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          <span className="font-heading text-xl text-foreground">{item.qty}</span>
          <span className="font-body text-[9px] text-foreground/40 uppercase">{item.unit}</span>
        </div>
        <div className="flex items-center gap-1">
          {item.refrigeration && <Thermometer className="w-3 h-3 text-blue-400" strokeWidth={1.5} />}
          {item.controlled && <Shield className="w-3 h-3 text-amber-400" strokeWidth={1.5} />}
        </div>
      </div>
      <p className="font-body text-[9px] text-foreground/35 mt-1 truncate">{item.location}</p>
    </Card>
  );
}

// ─── Kit Card ─────────────────────────────────────────────────────────────────
function KitCard({ kit, onOpen }) {
  const total = kit.items.length;
  const ready = kit.items.filter(i => i.ok).length;
  const pct = Math.round((ready / total) * 100);
  return (
    <Card onClick={() => onOpen(kit)} className="p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
            <BriefcaseMedical className="w-4 h-4 text-foreground/50" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-body text-sm font-semibold text-foreground leading-tight">{kit.name}</p>
            <p className="font-body text-[9px] text-foreground/40">{kit.kitType}{kit.assignedEvent ? ` · ${kit.assignedEvent}` : ''}</p>
          </div>
        </div>
        <StatusPill status={kit.status} small />
      </div>
      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="font-body text-[9px] text-foreground/40 uppercase tracking-[0.1em]">Items Ready</span>
          <span className="font-body text-[9px] text-foreground/60">{ready}/{total}</span>
        </div>
        <div className="h-1 rounded-full bg-foreground/10 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-400' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width:`${pct}%` }} />
        </div>
      </div>
      {kit.blockers.length > 0 && (
        <div className="space-y-0.5 mt-2">
          {kit.blockers.slice(0,2).map((b,i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
              <span className="font-body text-[9px] text-red-300/80">{b}</span>
            </div>
          ))}
          {kit.blockers.length > 2 && <span className="font-body text-[9px] text-foreground/30">+{kit.blockers.length - 2} more</span>}
        </div>
      )}
      <div className="flex items-center justify-between mt-3">
        <span className="font-body text-[9px] text-foreground/30">Checked {kit.lastCheckedAt}</span>
        {kit.assignedNurse && <span className="font-body text-[9px] text-teal-400">{kit.assignedNurse}</span>}
      </div>
    </Card>
  );
}

// ─── Item Detail Sheet ────────────────────────────────────────────────────────
function ItemDetailSheet({ item: initItem, onClose }) {
  const [qty, setQty] = useState(initItem.qty);
  const [note, setNote] = useState('');

  return (
    <motion.div
      initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
      transition={{ duration:0.4, ease:EASE }}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
      style={{ maxHeight:'92vh' }}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10" onClick={onClose} />
      <div className="relative bg-[#0d0d0d] border-t border-foreground/[0.1] rounded-t-3xl flex flex-col overflow-hidden">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4 border-b border-foreground/[0.06] shrink-0">
          <div className="flex-1 min-w-0">
            <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-1">{initItem.category} · {initItem.sku}</p>
            <h2 className="font-heading text-2xl text-foreground uppercase leading-tight pr-4">{initItem.name}</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusPill status={initItem.status} />
              <ExpiryBadge dateStr={initItem.expirationDate} />
              {initItem.refrigeration && (
                <span className="inline-flex items-center gap-1 font-body text-[8px] px-1.5 py-0.5 rounded-full border border-blue-500/25 text-blue-300 bg-blue-500/10 uppercase tracking-[0.1em]">
                  <Thermometer className="w-2.5 h-2.5" strokeWidth={2} /> Refrigerate
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/50 shrink-0">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Qty adjuster */}
          <div>
            <SectionLabel>Current Count</SectionLabel>
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] px-5 py-4 flex items-center justify-between">
              <QuantityAdjuster qty={qty} onAdd={() => setQty(q => q + 1)} onRemove={() => setQty(q => Math.max(0, q - 1))} />
              <div className="text-right">
                <p className="font-body text-[9px] text-foreground/35 uppercase tracking-[0.1em]">{initItem.unit}</p>
                <p className="font-body text-[9px] text-foreground/35 mt-1">Par: {initItem.parLevel}</p>
                <p className={`font-body text-[9px] mt-0.5 ${qty <= initItem.restockThreshold ? 'text-red-400' : 'text-foreground/35'}`}>
                  Min: {initItem.restockThreshold}
                </p>
              </div>
            </div>
          </div>

          {/* Key fields */}
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Location', initItem.location, MapPin],
              ['Supplier', initItem.supplier, Tag],
              ['Lot Number', initItem.lotNumber || '—', Hash],
              ['Expiration', initItem.expirationDate || 'None', Clock],
              ['Cost', initItem.cost ? `$${initItem.cost.toFixed(2)}` : '—', FileText],
              ['Last Checked', initItem.lastCheckedAt, CheckCircle],
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

          {/* QR */}
          <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-foreground/40" strokeWidth={1.5} />
              <div>
                <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35 mb-0.5">QR Code</p>
                <p className="font-body text-xs text-foreground/70">{initItem.qrCode}</p>
              </div>
            </div>
            <button type="button" className="font-body text-[9px] tracking-[0.12em] uppercase text-accent border border-accent/30 px-2.5 py-1 rounded-full hover:bg-accent/10 transition-colors">
              Show
            </button>
          </div>

          {/* Notes */}
          {initItem.notes && (
            <div className="rounded-xl border border-foreground/[0.06] px-4 py-3">
              <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35 mb-1">Notes</p>
              <p className="font-body text-xs text-foreground/60">{initItem.notes}</p>
            </div>
          )}

          {/* Add note */}
          <div>
            <SectionLabel>Add Note</SectionLabel>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Add a note..."
              className="w-full rounded-xl border border-foreground/15 bg-foreground/[0.03] px-4 py-3 font-body text-xs text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/35 resize-none" />
          </div>

          {/* Mode indicator */}
          <div className="rounded-xl border border-foreground/[0.06] px-4 py-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <p className="font-body text-[9px] tracking-[0.1em] text-foreground/35 uppercase">Local inventory active · Changes saved locally</p>
          </div>
        </div>

        {/* Action bar */}
        <div className="px-5 pt-3 pb-5 border-t border-foreground/[0.06] shrink-0"
          style={{ paddingBottom:'max(env(safe-area-inset-bottom), 1.25rem)' }}>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
            <QuickBtn icon={CheckCircle} label="Mark Counted" />
            <QuickBtn icon={RefreshCw}   label="Restock" />
            <QuickBtn icon={MoveRight}   label="Move" />
            <QuickBtn icon={AlertTriangle} label="Quarantine" />
            <QuickBtn icon={CheckCircle} label="Save Count" accent />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Kit Detail Sheet ─────────────────────────────────────────────────────────
function KitDetailSheet({ kit, onClose }) {
  return (
    <motion.div
      initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
      transition={{ duration:0.4, ease:EASE }}
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
      style={{ maxHeight:'92vh' }}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10" onClick={onClose} />
      <div className="relative bg-[#0d0d0d] border-t border-foreground/[0.1] rounded-t-3xl flex flex-col overflow-hidden">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>
        <div className="flex items-start justify-between px-5 pt-2 pb-4 border-b border-foreground/[0.06] shrink-0">
          <div>
            <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 mb-1">{kit.kitType}</p>
            <h2 className="font-heading text-2xl text-foreground uppercase leading-tight">{kit.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <StatusPill status={kit.status} />
              {kit.assignedNurse && <span className="font-body text-[9px] text-teal-400">{kit.assignedNurse}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/50 shrink-0">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Blockers */}
          {kit.blockers.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" strokeWidth={2} />
                <p className="font-body text-[9px] tracking-[0.2em] uppercase text-red-400">Kit Blockers</p>
              </div>
              {kit.blockers.map((b,i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                  <span className="font-body text-xs text-red-300/80">{b}</span>
                </div>
              ))}
            </div>
          )}

          {/* Items checklist */}
          <div>
            <SectionLabel>Kit Contents ({kit.items.filter(i => i.ok).length}/{kit.items.length} ready)</SectionLabel>
            <div className="space-y-1.5">
              {kit.items.map((item, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${item.ok ? 'border-foreground/[0.06] bg-foreground/[0.02]' : 'border-red-500/20 bg-red-500/[0.04]'}`}>
                  {item.ok
                    ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={2} />
                    : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={2} />}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs text-foreground">{item.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-body text-xs font-semibold ${item.ok ? 'text-foreground/60' : 'text-red-300'}`}>{item.current}/{item.required}</p>
                    <p className="font-body text-[8px] text-foreground/30">{item.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Last checked */}
          <div className="rounded-xl border border-foreground/[0.06] px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35 mb-0.5">Last Checked</p>
              <p className="font-body text-xs text-foreground/70">{kit.lastCheckedAt} · {kit.checkedBy}</p>
            </div>
            {kit.notes && <p className="font-body text-[9px] text-foreground/40 max-w-[160px] text-right leading-snug">{kit.notes}</p>}
          </div>
        </div>

        <div className="px-5 pt-3 pb-5 border-t border-foreground/[0.06] shrink-0"
          style={{ paddingBottom:'max(env(safe-area-inset-bottom), 1.25rem)' }}>
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth:'none' }}>
            <QuickBtn icon={CheckCircle} label="Check Kit" />
            <QuickBtn icon={RefreshCw}   label="Restock Kit" />
            <QuickBtn icon={User}        label="Assign" />
            <QuickBtn icon={CheckCircle} label="Mark Ready" accent />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────
function DashboardScreen({ onSelectItem, onSelectKit }) {
  const lowStock   = ITEMS.filter(i => ['Low Stock','Restock Needed','Out of Stock'].includes(i.status));
  const expiring   = ITEMS.filter(i => i.expirationDate && ['Critical','Urgent','Warning'].includes(expiryStatus(i.expirationDate)));
  const kitsReady  = KITS.filter(k => k.status === 'Kit Ready').length;
  const kitsNotRdy = KITS.filter(k => k.status !== 'Kit Ready').length;

  const tiles = [
    { icon:Package,       value:ITEMS.length, label:'Total Items',     sub:'across all locations', urgent:false },
    { icon:BriefcaseMedical, value:kitsReady, label:'Kits Ready',       sub:`${kitsNotRdy} need attention`, urgent:kitsNotRdy > 0 },
    { icon:AlertCircle,   value:lowStock.length,  label:'Low Stock',    sub:'below par or threshold', urgent:lowStock.length > 0 },
    { icon:Clock,         value:expiring.length,  label:'Expiring',     sub:'within 30 days',         urgent:expiring.length > 0 },
    { icon:RefreshCw,     value:RESTOCK.length,   label:'Restock Queue',sub:'items to order',         urgent:false },
    { icon:AlertTriangle, value:1,                label:'Quarantine',   sub:'do not use',             urgent:true  },
    { icon:Star,          value:1,                label:'Event Kits',   sub:'1 incomplete',            urgent:true  },
    { icon:TrendingUp,    value:'$—',             label:'Est. Value',   sub:'Manual tracking',        urgent:false },
  ];

  const risks = [
    { text:'Nurse Bag — Stephanie needs restock before 3PM',  level:'red',   action:'Restock' },
    { text:'Bay to Breakers event kit incomplete (Jun 12)',    level:'red',   action:'Review'  },
    { text:'Epinephrine 1mg/ml expiring in 6 days',            level:'red',   action:'Replace' },
    { text:'NAD+ 250mg expiring in 7 days',                    level:'amber', action:'Review'  },
    { text:'IV Bag 1L Saline below par — 3 kits affected',    level:'amber', action:'Restock' },
  ];

  // ── scroll-arrow state for metric strip ────────────────────────────────────
  const stripRef = useRef(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(true);

  const syncArrows = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    syncArrows();
    el.addEventListener('scroll', syncArrows, { passive: true });
    const ro = new ResizeObserver(syncArrows);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', syncArrows); ro.disconnect(); };
  }, [syncArrows]);

  const scrollStrip = (dir) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Metric strip */}
      <div className="relative -mx-4">
        {/* left arrow */}
        {canLeft && (
          <button
            type="button"
            onClick={() => scrollStrip(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-foreground/10 shadow-md ml-1"
            aria-label="Scroll left"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/70"/>
            </svg>
          </button>
        )}
        {/* right arrow */}
        {canRight && (
          <button
            type="button"
            onClick={() => scrollStrip(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-foreground/10 shadow-md mr-1"
            aria-label="Scroll right"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/70"/>
            </svg>
          </button>
        )}
        {/* fade edges */}
        {canLeft  && <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-background to-transparent z-[5]" />}
        {canRight && <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-background to-transparent z-[5]" />}
        {/* scrollable row */}
        <div
          ref={stripRef}
          className="px-4 flex gap-2.5 overflow-x-auto pb-1"
          style={{ scrollbarWidth:'none', WebkitOverflowScrolling:'touch' }}
        >
          {tiles.map(t => <MetricTile key={t.label} {...t} />)}
        </div>
      </div>

      {/* Risk card */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" strokeWidth={2} />
          <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/40">Inventory Risks</p>
        </div>
        <div className="space-y-2.5">
          {risks.map((r,i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.level === 'red' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <span className="font-body text-xs text-foreground/70 leading-snug">{r.text}</span>
              </div>
              <button type="button" className="shrink-0 font-body text-[8px] tracking-[0.12em] uppercase text-accent border border-accent/30 px-2 py-0.5 rounded-full hover:bg-accent/10 transition-colors whitespace-nowrap">
                {r.action}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Kits needing attention */}
      <div>
        <SectionLabel>Kits Needing Attention</SectionLabel>
        <div className="space-y-2.5">
          {KITS.filter(k => k.status !== 'Kit Ready').map(k => (
            <KitCard key={k.id} kit={k} onOpen={onSelectKit} />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <SectionLabel>Recent Activity</SectionLabel>
        </div>
        <div className="divide-y divide-foreground/[0.05]">
          {ACTIVITY_LOG.slice(0,5).map(a => (
            <div key={a.id} className="flex items-start gap-3 px-4 py-2.5">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ACT_DOT[a.type] || 'bg-foreground/30'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs text-foreground/75 leading-snug">{a.action} · {a.item}</p>
                <p className="font-body text-[9px] text-foreground/35 mt-0.5">{a.user} · {a.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Manual mode banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02]">
        <Activity className="w-4 h-4 text-accent shrink-0" strokeWidth={1.5} />
        <div>
          <p className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/40">SF Bay Area · Local Inventory Active</p>
          <p className="font-body text-[10px] text-foreground/55 mt-0.5">Manual tracking during launch. Scanner + sync coming post-beta.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Items Screen ─────────────────────────────────────────────────────────────
const ITEM_STATUS_FILTERS = ['All','Low Stock','Expiring','Assigned','Quarantine'];
const ITEM_CAT_FILTERS = ['All','IV','Medication','IM','PPE','Emergency','Device','Sharps'];

function ItemsScreen({ onSelectItem }) {
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('All');
  const [cat,    setCat]      = useState('All');

  const filtered = useMemo(() => {
    return ITEMS.filter(item => {
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase());
      const matchStatus = status === 'All'
        || (status === 'Low Stock'  && ['Low Stock','Restock Needed','Out of Stock'].includes(item.status))
        || (status === 'Expiring'   && ['Expiring Soon','Expired'].includes(item.status))
        || (status === 'Assigned'   && item.assignedNurse)
        || (status === 'Quarantine' && item.status === 'Quarantine');
      const matchCat = cat === 'All' || item.category === cat;
      return matchSearch && matchStatus && matchCat;
    });
  }, [search, status, cat]);

  return (
    <div className="space-y-4 pb-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" strokeWidth={1.5} />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search items, SKU..."
          className="w-full pl-9 pr-4 py-3 rounded-2xl border border-foreground/15 bg-foreground/[0.04] font-body text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/35"
        />
      </div>

      {/* Status chips */}
      <FilterChips options={ITEM_STATUS_FILTERS} active={status} onChange={setStatus} />

      {/* Category chips */}
      <FilterChips options={ITEM_CAT_FILTERS} active={cat} onChange={setCat} />

      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 px-1">{filtered.length} items</p>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-body text-sm text-foreground/30">No items match</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map(item => <ItemCard key={item.id} item={item} onOpen={onSelectItem} />)}
        </div>
      )}

      <button type="button"
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-foreground/20 text-foreground/40 hover:text-foreground/60 transition-colors">
        <Plus className="w-4 h-4" strokeWidth={2} />
        <span className="font-body text-xs tracking-[0.15em] uppercase">Add Item</span>
      </button>
    </div>
  );
}

// ─── Kits Screen ─────────────────────────────────────────────────────────────
const KIT_FILTERS = ['All','Nurse Bags','Event Kits','Ready','Needs Attention'];

function KitsScreen({ onSelectKit }) {
  const [filter, setFilter] = useState('All');
  const filtered = useMemo(() => {
    return KITS.filter(k => {
      if (filter === 'All')             return true;
      if (filter === 'Nurse Bags')      return k.kitType === 'Nurse Bag';
      if (filter === 'Event Kits')      return k.kitType === 'Event Kit';
      if (filter === 'Ready')           return k.status === 'Kit Ready';
      if (filter === 'Needs Attention') return k.status !== 'Kit Ready';
      return true;
    });
  }, [filter]);

  return (
    <div className="space-y-4 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 px-1">
        Kit Tracker · {KITS.filter(k => k.status === 'Kit Ready').length}/{KITS.length} ready
      </p>
      <FilterChips options={KIT_FILTERS} active={filter} onChange={setFilter} />
      <div className="space-y-2.5">
        {filtered.map(k => <KitCard key={k.id} kit={k} onOpen={onSelectKit} />)}
      </div>
      <button type="button"
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-dashed border-foreground/20 text-foreground/40 hover:text-foreground/60 transition-colors">
        <Plus className="w-4 h-4" strokeWidth={2} />
        <span className="font-body text-xs tracking-[0.15em] uppercase">Build Kit</span>
      </button>
    </div>
  );
}

// ─── Restock Screen ───────────────────────────────────────────────────────────
function RestockScreen() {
  const [ordered, setOrdered] = useState(new Set());
  const high = RESTOCK.filter(r => r.priority === 'High');
  const other = RESTOCK.filter(r => r.priority !== 'High');

  function RestockCard({ r }) {
    const done = ordered.has(r.id);
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="font-body text-sm font-semibold text-foreground">{r.name}</p>
            <p className="font-body text-[9px] text-foreground/40">{r.category} · {r.supplier}</p>
          </div>
          <span className={`font-body text-[8px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border font-semibold ${r.priority === 'High' ? 'border-red-500/25 text-red-300 bg-red-500/10' : r.priority === 'Med' ? 'border-amber-500/25 text-amber-300 bg-amber-500/10' : 'border-foreground/15 text-foreground/45 bg-foreground/[0.04]'}`}>
            {r.priority}
          </span>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <div className="text-center">
            <p className="font-heading text-xl text-foreground">{r.current}</p>
            <p className="font-body text-[8px] text-foreground/35 uppercase tracking-[0.1em]">Current</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-foreground/25" strokeWidth={2} />
          <div className="text-center">
            <p className="font-heading text-xl text-orange-300">{r.par}</p>
            <p className="font-body text-[8px] text-foreground/35 uppercase tracking-[0.1em]">Par</p>
          </div>
          <div className="ml-auto text-center">
            <p className="font-heading text-xl text-foreground">+{r.needed}</p>
            <p className="font-body text-[8px] text-foreground/35 uppercase tracking-[0.1em]">Order</p>
          </div>
        </div>
        {r.relatedKit && (
          <p className="font-body text-[9px] text-foreground/40 mb-3">Affects: {r.relatedKit}</p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => setOrdered(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-body text-[10px] tracking-[0.12em] uppercase font-semibold border transition-all ${done ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300' : 'bg-foreground text-background border-foreground'}`}>
            {done ? <><CheckCircle className="w-3 h-3" strokeWidth={2} /> Ordered</> : <><RefreshCw className="w-3 h-3" strokeWidth={2} /> Mark Ordered</>}
          </button>
          <QuickBtn icon={Edit3} label="Note" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between px-1">
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35">Restock Queue · {RESTOCK.length} items</p>
        <span className="font-body text-[9px] text-amber-400 tracking-[0.1em] uppercase border border-amber-400/30 px-2 py-0.5 rounded-full">Manual Mode</span>
      </div>
      {high.length > 0 && (
        <div>
          <SectionLabel>High Priority</SectionLabel>
          <div className="space-y-2.5">{high.map(r => <RestockCard key={r.id} r={r} />)}</div>
        </div>
      )}
      {other.length > 0 && (
        <div>
          <SectionLabel>Standard</SectionLabel>
          <div className="space-y-2.5">{other.map(r => <RestockCard key={r.id} r={r} />)}</div>
        </div>
      )}
    </div>
  );
}

// ─── Expiry Screen ────────────────────────────────────────────────────────────
const EXPIRY_FILTERS = ['All','Expired','7 Days','14 Days','30 Days'];

function ExpiryScreen({ onSelectItem }) {
  const [filter, setFilter] = useState('All');

  const filtered = useMemo(() => {
    return EXPIRY_ITEMS.filter(item => {
      const d = daysUntil(item.expirationDate);
      if (filter === 'All')     return true;
      if (filter === 'Expired') return d <= 0;
      if (filter === '7 Days')  return d > 0 && d <= 7;
      if (filter === '14 Days') return d > 7 && d <= 14;
      if (filter === '30 Days') return d > 14 && d <= 30;
      return true;
    });
  }, [filter]);

  return (
    <div className="space-y-4 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 px-1">Expiration Queue · {EXPIRY_ITEMS.length} items</p>
      <FilterChips options={EXPIRY_FILTERS} active={filter} onChange={setFilter} />
      {filtered.length === 0 ? (
        <div className="text-center py-12"><p className="font-body text-sm text-foreground/30">No items in this window</p></div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(item => {
            const d = daysUntil(item.expirationDate);
            const est = expiryStatus(item.expirationDate);
            const borderColor = est === 'Expired' ? 'border-red-900/30' : est === 'Critical' ? 'border-red-500/25' : est === 'Urgent' ? 'border-orange-500/25' : 'border-amber-500/20';
            return (
              <Card key={item.id} onClick={() => onSelectItem(item)} className={`p-4 ${borderColor}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-body text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="font-body text-[9px] text-foreground/40">{item.category} · Lot: {item.lotNumber || '—'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusPill status={est === 'Expired' ? 'Expired' : 'Expiring Soon'} small />
                    <span className={`font-heading text-xl ${est === 'Expired' ? 'text-red-400' : est === 'Critical' ? 'text-red-300' : est === 'Urgent' ? 'text-orange-300' : 'text-amber-300'}`}>
                      {d <= 0 ? 'EXPIRED' : `${d}d`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-body text-[8px] uppercase tracking-[0.1em] text-foreground/35">Expires</p>
                    <p className="font-body text-xs text-foreground/70">{item.expirationDate}</p>
                  </div>
                  <div>
                    <p className="font-body text-[8px] uppercase tracking-[0.1em] text-foreground/35">Qty</p>
                    <p className="font-body text-xs text-foreground/70">{item.qty} {item.unit}</p>
                  </div>
                  <div>
                    <p className="font-body text-[8px] uppercase tracking-[0.1em] text-foreground/35">Location</p>
                    <p className="font-body text-xs text-foreground/70 truncate max-w-[120px]">{item.location}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <QuickBtn icon={CheckCircle}  label="Reviewed" small />
                  <QuickBtn icon={AlertTriangle} label="Quarantine" small />
                  <QuickBtn icon={RefreshCw}     label="Replace" small accent />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Folders Screen ───────────────────────────────────────────────────────────
function FoldersScreen() {
  return (
    <div className="space-y-5 pb-6">
      {FOLDER_GROUPS.map(group => {
        const children = FOLDERS.filter(f => f.parentId === group.id);
        if (children.length === 0) return null;
        return (
          <div key={group.id}>
            <SectionLabel>{group.label}</SectionLabel>
            <div className="space-y-2">
              {children.map(folder => {
                const FIcon = folder.icon;
                return (
                  <Card key={folder.id} onClick={() => {}} className="px-4 py-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
                          <FIcon className="w-4 h-4 text-foreground/50" strokeWidth={1.5} />
                        </div>
                        <div>
                          <p className="font-body text-sm text-foreground">{folder.name}</p>
                          <p className="font-body text-[9px] text-foreground/40">{folder.itemCount} items</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {folder.lowStock > 0 && <span className="font-body text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">{folder.lowStock} low</span>}
                        {folder.expiring > 0 && <span className="font-body text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">{folder.expiring} exp</span>}
                        <ChevronRight className="w-4 h-4 text-foreground/25" strokeWidth={1.5} />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Activity Screen ──────────────────────────────────────────────────────────
function ActivityScreen() {
  return (
    <div className="space-y-4 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 px-1">Inventory Activity Log</p>
      <Card className="overflow-hidden divide-y divide-foreground/[0.05]">
        {ACTIVITY_LOG.map(a => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3">
            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ACT_DOT[a.type] || 'bg-foreground/30'}`} />
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs text-foreground/75 leading-snug">{a.action}</p>
              <p className="font-body text-[10px] text-foreground/55 mt-0.5">{a.item}</p>
              <p className="font-body text-[9px] text-foreground/30 mt-0.5">{a.user} · {a.time}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Reports Screen ───────────────────────────────────────────────────────────
function ReportsScreen() {
  const totalValue = ITEMS.reduce((s, i) => s + (i.qty * i.cost), 0);
  const byCategory = ITEMS.reduce((acc, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc; }, {});
  const stats = [
    { label:'Total Items',    value: ITEMS.length.toString(),           sub:'all locations' },
    { label:'Est. Value',     value:`$${totalValue.toFixed(0)}`,        sub:'cost × qty'    },
    { label:'Low Stock',      value: ITEMS.filter(i => ['Low Stock','Restock Needed'].includes(i.status)).length.toString(), sub:'below par'  },
    { label:'Expiring Soon',  value: EXPIRY_ITEMS.length.toString(),    sub:'within 30 days'},
    { label:'Kits Ready',     value: `${KITS.filter(k=>k.status==='Kit Ready').length}/${KITS.length}`, sub:'kit readiness' },
    { label:'Restock Queue',  value: RESTOCK.length.toString(),         sub:'items pending' },
    { label:'Categories',     value: Object.keys(byCategory).length.toString(), sub:'item types' },
    { label:'Tracking Mode',  value:'Manual',                           sub:'local inventory active' },
  ];
  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between px-1">
        <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35">Inventory Snapshot</p>
        <span className="font-body text-[9px] text-foreground/35 tracking-[0.1em] uppercase">Manual Estimates</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <p className="font-body text-[8px] tracking-[0.2em] uppercase text-foreground/35 mb-1.5">{s.label}</p>
            <p className="font-heading text-2xl text-foreground leading-none">{s.value}</p>
            <p className="font-body text-[9px] text-foreground/35 mt-1">{s.sub}</p>
          </Card>
        ))}
      </div>
      <div>
        <SectionLabel>By Category</SectionLabel>
        <div className="space-y-2">
          {Object.entries(byCategory).sort((a,b) => b[1]-a[1]).map(([cat, count]) => (
            <div key={cat} className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-foreground/[0.06] bg-foreground/[0.02]">
              <span className="font-body text-sm text-foreground/70">{cat}</span>
              <span className="font-body text-sm font-semibold text-foreground">{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-foreground/[0.06] px-4 py-3">
        <p className="font-body text-[9px] text-foreground/35 tracking-[0.1em] uppercase">Advanced analytics + supplier ordering launch post-beta.</p>
      </div>
    </div>
  );
}

// ─── More Menu Sheet ──────────────────────────────────────────────────────────
const MORE_NAV = [
  { screen:'expiry',   icon: Clock,       label:'Expiry Queue'    },
  { screen:'folders',  icon: FolderOpen,  label:'Folder Browser'  },
  { screen:'activity', icon: Activity,    label:'Activity Log'    },
  { screen:'reports',  icon: BarChart3,   label:'Reports'         },
  { screen:'settings', icon: Settings,    label:'Settings'        },
];

function MoreMenuSheet({ onClose, onNav }) {
  return (
    <motion.div
      initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
      transition={{ duration:0.38, ease:EASE }}
      className="fixed inset-x-0 bottom-0 z-50 bg-[#0d0d0d] border-t border-foreground/[0.1] rounded-t-3xl"
      style={{ paddingBottom:'max(env(safe-area-inset-bottom), 1.5rem)' }}
    >
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10" onClick={onClose} />
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
        {MORE_NAV.map(({ screen, icon: Icon, label }) => (
          <button key={screen} type="button" onClick={() => { onNav(screen); onClose(); }}
            className="w-full flex items-center gap-3.5 px-3 py-3.5 rounded-xl mb-0.5 text-left hover:bg-foreground/[0.04] transition-colors">
            <Icon className="w-5 h-5 text-foreground/45 shrink-0" strokeWidth={1.5} />
            <span className="font-body text-sm text-foreground">{label}</span>
            <ChevronRight className="w-4 h-4 text-foreground/25 ml-auto" strokeWidth={1.5} />
          </button>
        ))}
      </nav>
      <div className="px-3 pt-2 border-t border-foreground/[0.06]">
        <Link to="/admin"
          className="flex items-center gap-3.5 px-3 py-3 rounded-xl text-foreground/50 hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5 shrink-0" strokeWidth={1.5} />
          <span className="font-body text-sm">Back to Avalon OS</span>
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────
function SettingsScreen() {
  const sections = [
    { label:'Categories',           sub:'IV, IM, Medication, PPE, Emergency…', icon:Tag      },
    { label:'Units',                sub:'bags, vials, boxes, syringes…',        icon:Hash     },
    { label:'Locations / Folders',  sub:'SF Hub, Nurse Bags, Events…',          icon:FolderOpen },
    { label:'Kit Templates',        sub:'Nurse Bag, Event Kit, IM Shot Kit…',   icon:BriefcaseMedical },
    { label:'Custom Fields',        sub:'Lot number, supplier, clinical use…',  icon:FileText },
    { label:'Expiry Windows',       sub:'30d warn · 14d urgent · 7d critical',  icon:Clock    },
    { label:'Low Stock Thresholds', sub:'Per-item par levels + restock mins',   icon:AlertCircle },
    { label:'QR Label Format',      sub:'AV-{category}-{sku}-{seq}',            icon:QrCode   },
  ];
  return (
    <div className="space-y-3 pb-6">
      <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/35 px-1">Inventory Settings</p>
      {sections.map(s => {
        const Icon = s.icon;
        return (
          <Card key={s.label} onClick={() => {}} className="px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-foreground/[0.06] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-foreground/50" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm text-foreground">{s.label}</p>
                <p className="font-body text-[9px] text-foreground/40">{s.sub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/25 shrink-0" strokeWidth={1.5} />
            </div>
          </Card>
        );
      })}
      <div className="rounded-xl border border-foreground/[0.06] px-4 py-3 mt-2">
        <p className="font-body text-[9px] text-foreground/35 tracking-[0.1em] uppercase">
          Settings sync + multi-user roles launch post-beta.
        </p>
      </div>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
const BOTTOM_TABS = [
  { screen:'dashboard', icon: LayoutDashboard, label:'Dashboard' },
  { screen:'items',     icon: Package,         label:'Items'     },
  { screen:'kits',      icon: BriefcaseMedical,label:'Kits'      },
  { screen:'restock',   icon: RefreshCw,       label:'Restock'   },
];

const SCREEN_TITLES = {
  dashboard: 'AVALON INVENTORY',
  items:     'ITEM CATALOG',
  kits:      'KIT TRACKER',
  restock:   'RESTOCK QUEUE',
  expiry:    'EXPIRY QUEUE',
  folders:   'FOLDERS',
  activity:  'ACTIVITY LOG',
  reports:   'REPORTS',
  settings:  'SETTINGS',
};

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Inventory() {
  const [screen,          setScreen]          = useState('dashboard');
  const [selectedItem,    setSelectedItem]    = useState(null);
  const [selectedKit,     setSelectedKit]     = useState(null);
  const [moreOpen,        setMoreOpen]        = useState(false);

  const isMoreScreen = !BOTTOM_TABS.find(t => t.screen === screen);

  return (
    <div className="bg-background text-foreground flex flex-col max-w-[430px] mx-auto overflow-hidden" style={{ height: '100dvh' }}>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="shrink-0 bg-background border-b border-foreground/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {isMoreScreen && (
              <button type="button" onClick={() => setScreen('dashboard')}
                className="w-7 h-7 flex items-center justify-center text-foreground/50 hover:text-foreground">
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-[13px] tracking-[0.35em] text-foreground">AV</span>
                <span className="font-body text-[8px] tracking-[0.2em] uppercase px-1.5 py-0.5 rounded-full border border-accent/40 text-accent bg-accent/10">
                  INVENTORY
                </span>
              </div>
              <p className="font-body text-[8px] tracking-[0.15em] uppercase text-foreground/35 mt-0.5">{TODAY_LABEL}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-foreground/15 text-foreground/50 hover:text-foreground transition-colors">
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              <span className="font-body text-[9px] tracking-[0.12em] uppercase">Add</span>
            </button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <h1 className="font-heading text-3xl text-foreground uppercase leading-none tracking-tight">
            {SCREEN_TITLES[screen]}
          </h1>
          <p className="font-body text-[9px] tracking-[0.2em] uppercase text-foreground/35 mt-1">
            SF Bay Area · Local Inventory Active
          </p>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 pt-2" style={{ paddingBottom:'5.5rem' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-6 }} transition={{ duration:0.25, ease:EASE }}
          >
            {screen === 'dashboard' && <DashboardScreen onSelectItem={setSelectedItem} onSelectKit={setSelectedKit} />}
            {screen === 'items'     && <ItemsScreen     onSelectItem={setSelectedItem} />}
            {screen === 'kits'      && <KitsScreen      onSelectKit={setSelectedKit}  />}
            {screen === 'restock'   && <RestockScreen />}
            {screen === 'expiry'    && <ExpiryScreen    onSelectItem={setSelectedItem} />}
            {screen === 'folders'   && <FoldersScreen />}
            {screen === 'activity'  && <ActivityScreen />}
            {screen === 'reports'   && <ReportsScreen  />}
            {screen === 'settings'  && <SettingsScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Bottom Nav ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-background border-t border-foreground/[0.12] max-w-[430px] mx-auto"
        style={{ paddingBottom:'max(env(safe-area-inset-bottom), 0px)' }}>
        <div className="flex items-stretch">
          {BOTTOM_TABS.map(({ screen: s, icon: Icon, label }) => {
            const active = screen === s;
            return (
              <button key={s} type="button" onClick={() => setScreen(s)}
                className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 relative transition-colors"
                style={{ color: active ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.65)' }}>
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-accent" />}
                {s === 'restock' && RESTOCK.length > 0 && (
                  <span className="absolute top-2 right-[22%] w-4 h-4 rounded-full bg-orange-400 text-background font-body text-[8px] font-bold flex items-center justify-center leading-none">
                    {RESTOCK.length}
                  </span>
                )}
                <Icon className="w-[22px] h-[22px] shrink-0" strokeWidth={active ? 2 : 1.5} />
                <span className={`font-body text-[9px] tracking-[0.08em] uppercase leading-none ${active ? 'font-semibold' : ''}`}>{label}</span>
              </button>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 relative transition-colors"
            style={{ color: isMoreScreen ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.65)' }}>
            {isMoreScreen && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-accent" />}
            <MoreHorizontal className="w-[22px] h-[22px] shrink-0" strokeWidth={isMoreScreen ? 2 : 1.5} />
            <span className={`font-body text-[9px] tracking-[0.08em] uppercase leading-none ${isMoreScreen ? 'font-semibold' : ''}`}>More</span>
          </button>
        </div>
      </div>

      {/* ── Item Detail Sheet ────────────────────────────────────── */}
      <AnimatePresence>
        {selectedItem && (
          <ItemDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
      </AnimatePresence>

      {/* ── Kit Detail Sheet ─────────────────────────────────────── */}
      <AnimatePresence>
        {selectedKit && (
          <KitDetailSheet kit={selectedKit} onClose={() => setSelectedKit(null)} />
        )}
      </AnimatePresence>

      {/* ── More Menu Sheet ──────────────────────────────────────── */}
      <AnimatePresence>
        {moreOpen && (
          <MoreMenuSheet onClose={() => setMoreOpen(false)} onNav={s => setScreen(s)} />
        )}
      </AnimatePresence>
    </div>
  );
}
