export const STAFF = [];
export const SERVICES = [];
export const CLIENTS = [];
export const APPOINTMENTS = [];
export const INVOICES = [];
export const EXPENSES = [];
export const ACTIVITY_LOG = [];

export const getClient = () => undefined;
export const getStaff = () => undefined;
export const getService = () => undefined;
export const getClientName = () => '—';
export const getStaffName = () => '—';
export const getServiceName = () => '—';
export const formatCurrency = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
export const formatDate = (str) => (str ? new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
export const formatTime = (str) => (str ? new Date(str).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—');
export const formatDateTime = (str) => (str ? new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—');
export const getDashboardStats = () => ({
  thisMonthRevenue: 0,
  lastMonthRevenue: 0,
  revenueChange: 0,
  apptThisWeek: 0,
  apptCompleted: 0,
  apptCancelled: 0,
  newClientsThisMonth: 0,
  outstandingCount: 0,
  outstandingTotal: 0,
});
export const getUpcomingAppointments = () => [];
export const getMonthlyRevenue = () => [];
