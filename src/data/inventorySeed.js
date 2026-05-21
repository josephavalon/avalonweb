// Seed data used as fallback when Supabase is not configured.
// When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set, this data is
// ignored and real DB rows are loaded instead.

export const SEED_FOLDERS = [
  { id:'f-root',    name:'Avalon Vitality',  parentId:null,        color:'#d4a754', itemCount:21, updatedAt:'2026-05-18' },
  { id:'f-iv',      name:'IV Supplies',      parentId:'f-root',    color:'#60a5fa', itemCount:5,  updatedAt:'2026-05-18' },
  { id:'f-add',     name:'Add-On Meds',      parentId:'f-root',    color:'#a78bfa', itemCount:4,  updatedAt:'2026-05-19' },
  { id:'f-im',      name:'IM Supplies',      parentId:'f-root',    color:'#34d399', itemCount:4,  updatedAt:'2026-05-17' },
  { id:'f-ppe',     name:'PPE',              parentId:'f-root',    color:'#fb923c', itemCount:2,  updatedAt:'2026-05-10' },
  { id:'f-em',      name:'Emergency',        parentId:'f-root',    color:'#f87171', itemCount:2,  updatedAt:'2026-05-14' },
  { id:'f-dv',      name:'Devices',          parentId:'f-root',    color:'#38bdf8', itemCount:2,  updatedAt:'2026-05-12' },
  { id:'f-storage', name:'Storage',          parentId:null,        color:'#6b7280', itemCount:1,  updatedAt:'2026-04-20' },
  { id:'f-sh',      name:'Sharps Disposal',  parentId:'f-storage', color:'#ef4444', itemCount:1,  updatedAt:'2026-04-20' },
];

export const SEED_TAGS = [
  { id:'t1', name:'Refrigerate',    color:'#60a5fa' },
  { id:'t2', name:'Emergency Only', color:'#ef4444' },
  { id:'t3', name:'Check Weekly',   color:'#f59e0b' },
  { id:'t4', name:'Controlled',     color:'#a78bfa' },
  { id:'t5', name:'High Value',     color:'#34d399' },
  { id:'t6', name:'Reorder Now',    color:'#fb923c' },
];

export const SEED_ITEMS = [
  { id:'iv1',  sortlyId:'AVOT0001', name:'IV Bag — 1L Normal Saline',  sku:'IV-NS-1L',    category:'IV',        folderId:'f-iv',  qty:12, unit:'bags',     minLevel:8,  price:4.50,  supplier:'Bound Tree Medical', expirationDate:'2026-09-15', refrigeration:false, notes:'Reorder from Bound Tree. Min order 24.',       tags:['t1'],      isNew:false, updatedAt:'2026-05-18' },
  { id:'iv2',  sortlyId:'AVOT0002', name:'IV Start Kit',               sku:'IV-SK-STD',   category:'IV',        folderId:'f-iv',  qty:6,  unit:'kits',     minLevel:4,  price:8.75,  supplier:'Bound Tree Medical', expirationDate:'2027-03-01', refrigeration:false, notes:'Includes tourniquet, tegaderm, 20g catheter.', tags:[],          isNew:true,  updatedAt:'2026-05-19' },
  { id:'iv3',  sortlyId:'AVOT0003', name:'IV Extension Set (10")',     sku:'IV-EXT-10',   category:'IV',        folderId:'f-iv',  qty:18, unit:'sets',     minLevel:8,  price:2.25,  supplier:'Bound Tree Medical', expirationDate:'2027-06-01', refrigeration:false, notes:'',                                             tags:[],          isNew:false, updatedAt:'2026-05-17' },
  { id:'rx1',  sortlyId:'AVOT0004', name:'NAD+ 250mg vial',            sku:'RX-NAD-250',  category:'Medication',folderId:'f-add', qty:8,  unit:'vials',    minLevel:3,  price:85.00, supplier:'Olympia Pharmacy',   expirationDate:'2026-05-19', refrigeration:true,  notes:'Refrigerate. Check expiry weekly.',             tags:['t1','t5'], isNew:false, updatedAt:'2026-05-15' },
  { id:'rx2',  sortlyId:'AVOT0005', name:'Glutathione 600mg vial',     sku:'RX-GLU-600',  category:'Medication',folderId:'f-add', qty:14, unit:'vials',    minLevel:6,  price:22.00, supplier:'Olympia Pharmacy',   expirationDate:'2026-08-10', refrigeration:true,  notes:'Refrigerate.',                                 tags:['t1'],      isNew:false, updatedAt:'2026-05-16' },
  { id:'rx3',  sortlyId:'AVOT0006', name:'Vitamin C 50ml (50g/L)',     sku:'RX-VIC-50',   category:'Medication',folderId:'f-add', qty:3,  unit:'vials',    minLevel:4,  price:18.50, supplier:'Olympia Pharmacy',   expirationDate:'2026-06-05', refrigeration:true,  notes:'Order this week.',                              tags:['t1','t6'], isNew:false, updatedAt:'2026-05-10' },
  { id:'rx4',  sortlyId:'AVOT0007', name:'B-Complex vial',             sku:'RX-BCP-10',   category:'Medication',folderId:'f-iv',  qty:22, unit:'vials',    minLevel:8,  price:9.00,  supplier:'Olympia Pharmacy',   expirationDate:'2026-12-01', refrigeration:false, notes:'',                                             tags:[],          isNew:false, updatedAt:'2026-05-14' },
  { id:'rx5',  sortlyId:'AVOT0008', name:'Magnesium Sulfate vial',     sku:'RX-MAG-5',    category:'Medication',folderId:'f-iv',  qty:16, unit:'vials',    minLevel:6,  price:7.50,  supplier:'Olympia Pharmacy',   expirationDate:'2026-11-15', refrigeration:false, notes:'',                                             tags:[],          isNew:false, updatedAt:'2026-05-13' },
  { id:'rx6',  sortlyId:'AVOT0009', name:'CBD 33mg vial',              sku:'RX-CBD-33',   category:'Medication',folderId:'f-add', qty:6,  unit:'vials',    minLevel:3,  price:45.00, supplier:'Olympia Pharmacy',   expirationDate:'2026-06-01', refrigeration:false, notes:'Exp. Jun 2026 — check before use.',            tags:[],          isNew:false, updatedAt:'2026-05-12' },
  { id:'rx7',  sortlyId:'AVOT0010', name:'Ondansetron (Zofran) 4mg',  sku:'RX-ZOF-4',    category:'Medication',folderId:'f-iv',  qty:20, unit:'vials',    minLevel:8,  price:6.50,  supplier:'Olympia Pharmacy',   expirationDate:'2027-01-01', refrigeration:false, notes:'',                                             tags:[],          isNew:true,  updatedAt:'2026-05-19' },
  { id:'im1',  sortlyId:'AVOT0011', name:'B12 IM vial (1000mcg/ml)',  sku:'IM-B12-1',    category:'IM',        folderId:'f-im',  qty:18, unit:'vials',    minLevel:8,  price:5.50,  supplier:'Olympia Pharmacy',   expirationDate:'2027-02-15', refrigeration:false, notes:'',                                             tags:[],          isNew:false, updatedAt:'2026-05-16' },
  { id:'im2',  sortlyId:'AVOT0012', name:'MIC Lipotropic IM vial',    sku:'IM-MIC-5',    category:'IM',        folderId:'f-im',  qty:12, unit:'vials',    minLevel:4,  price:14.00, supplier:'Olympia Pharmacy',   expirationDate:'2026-09-20', refrigeration:true,  notes:'Refrigerate.',                                 tags:['t1'],      isNew:false, updatedAt:'2026-05-15' },
  { id:'im3',  sortlyId:'AVOT0013', name:'Biotin IM vial (10mg/ml)',  sku:'IM-BIO-10',   category:'IM',        folderId:'f-im',  qty:10, unit:'vials',    minLevel:4,  price:10.00, supplier:'Olympia Pharmacy',   expirationDate:'2026-10-01', refrigeration:false, notes:'',                                             tags:[],          isNew:false, updatedAt:'2026-05-14' },
  { id:'im4',  sortlyId:'AVOT0014', name:'IM Syringe 3ml (23g)',      sku:'IM-SYR-3',    category:'IM',        folderId:'f-im',  qty:40, unit:'syringes', minLevel:15, price:0.85,  supplier:'Bound Tree Medical', expirationDate:'2028-01-01', refrigeration:false, notes:'',                                             tags:[],          isNew:false, updatedAt:'2026-05-13' },
  { id:'pp1',  sortlyId:'AVOT0015', name:'Nitrile Gloves — Lg (box)', sku:'PPE-GLV-LG',  category:'PPE',       folderId:'f-ppe', qty:4,  unit:'boxes',    minLevel:2,  price:12.00, supplier:'McKesson',           expirationDate:null,         refrigeration:false, notes:'',                                             tags:[],          isNew:false, updatedAt:'2026-05-11' },
  { id:'pp2',  sortlyId:'AVOT0016', name:'N95 Mask',                  sku:'PPE-N95-STD', category:'PPE',       folderId:'f-ppe', qty:24, unit:'masks',    minLevel:8,  price:2.50,  supplier:'McKesson',           expirationDate:'2029-01-01', refrigeration:false, notes:'',                                             tags:[],          isNew:false, updatedAt:'2026-05-10' },
  { id:'sh1',  sortlyId:'AVOT0017', name:'Sharps Container 1qt',      sku:'DIS-SHC-1',   category:'Sharps',    folderId:'f-sh',  qty:8,  unit:'units',    minLevel:3,  price:4.75,  supplier:'McKesson',           expirationDate:null,         refrigeration:false, notes:'Do not overfill.',                              tags:[],          isNew:false, updatedAt:'2026-04-20' },
  { id:'em1',  sortlyId:'AVOT0018', name:'Epinephrine 1mg/ml (1ml)',  sku:'EM-EPI-1',    category:'Emergency', folderId:'f-em',  qty:4,  unit:'vials',    minLevel:2,  price:32.00, supplier:'Olympia Pharmacy',   expirationDate:'2026-05-18', refrigeration:false, notes:'Check expiry before each shift. Critical.',     tags:['t2'],      isNew:false, updatedAt:'2026-05-18' },
  { id:'em2',  sortlyId:'AVOT0019', name:'Diphenhydramine 50mg vial', sku:'EM-DPH-50',   category:'Emergency', folderId:'f-em',  qty:6,  unit:'vials',    minLevel:2,  price:8.50,  supplier:'Olympia Pharmacy',   expirationDate:'2027-03-15', refrigeration:false, notes:'Anaphylaxis protocol.',                         tags:['t2'],      isNew:false, updatedAt:'2026-05-14' },
  { id:'dv1',  sortlyId:'AVOT0020', name:'Digital BP Cuff',           sku:'DEV-BP-DIG',  category:'Device',    folderId:'f-dv',  qty:4,  unit:'units',    minLevel:2,  price:65.00, supplier:'Omron',              expirationDate:null,         refrigeration:false, notes:'Check battery before each shift.',               tags:[],          isNew:false, updatedAt:'2026-05-12' },
  { id:'dv2',  sortlyId:'AVOT0021', name:'Pulse Oximeter',            sku:'DEV-POX-STD', category:'Device',    folderId:'f-dv',  qty:4,  unit:'units',    minLevel:2,  price:42.00, supplier:'Masimo',             expirationDate:null,         refrigeration:false, notes:'',                                             tags:[],          isNew:false, updatedAt:'2026-05-12' },
];

export const DEFAULT_SETTINGS = {
  orgName:        'Avalon Vitality',
  currency:       'USD',
  lowThreshold:   'auto',
  idPrefix:       'AVOT',
  idCounter:      22,
  emailAlerts:    false,
  alertEmail:     '',
};
