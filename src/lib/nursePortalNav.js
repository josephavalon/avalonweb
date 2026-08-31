import {
  BriefcaseBusiness,
  FileText,
  Package,
  Settings,
  Stethoscope,
} from 'lucide-react';

export function nursePortalNav(activeShiftId = '') {
  return [
    { label: 'Work', to: '/provider/shifts', icon: BriefcaseBusiness, exact: true },
    ...(activeShiftId ? [{
      label: 'Shift',
      to: `/provider/shifts/${encodeURIComponent(activeShiftId)}`,
      icon: Stethoscope,
      primary: true,
      exact: true,
    }] : []),
    { label: 'Time & Pay', to: '/provider/invoices', icon: FileText, exact: true },
    { label: 'Kit', to: '/provider/kit', icon: Package, exact: true },
    { label: 'Me', to: '/provider/settings', icon: Settings, exact: true },
  ];
}
