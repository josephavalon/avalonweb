import { readActivity, readLastBooking } from './localOs';
import { resolveGfeRequirement } from './bookingLifecycle';
import { evaluateClinicalClearance } from './clinicalClearance';
import { COVERED_ZIPS, extractZip } from './serviceArea';
import {
  buildLiveVisitTimeline,
  estimateShiftValue,
  inferBookingCity,
  readAssignmentBroadcasts,
  readClientProfile,
  readEventPresales,
  readGfeRoutingQueue,
  readOpsMessages,
  readSupportThread,
} from './platformOps';

const REAL_BUILD_COUNT = 23;

function nowIso() {
  return new Date().toISOString();
}

function formatStamp(value) {
  if (!value) return 'Not updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function statusTone(status = '') {
  if (/ready|clear|paid|valid|assigned|live|armed|complete|sent/i.test(status)) return 'ready';
  if (/action|needed|required|pending|manual|unassigned|request/i.test(status)) return 'action';
  if (/blocked|failed|expired|missing|not available/i.test(status)) return 'blocked';
  return 'neutral';
}

function module({
  key,
  group,
  label,
  value,
  status,
  owner,
  detail,
  nextAction,
  source,
  updatedAt,
  actionHref = null,
  actionLabel = null,
}) {
  return {
    key,
    group,
    label,
    value,
    status,
    tone: statusTone(status),
    owner,
    detail,
    nextAction,
    source,
    updatedAt: updatedAt || nowIso(),
    updatedLabel: formatStamp(updatedAt || nowIso()),
    actionHref,
    actionLabel,
  };
}

function serviceableStatus(zip) {
  if (!zip) {
    return {
      value: 'Review',
      status: 'Manual',
      detail: 'No ZIP detected. Avalon should verify coverage before dispatch.',
    };
  }
  if (COVERED_ZIPS.has(zip)) {
    return {
      value: 'In zone',
      status: 'Ready',
      detail: `${zip} is in the current Bay Area service map.`,
    };
  }
  return {
    value: 'Out of zone',
    status: 'Action',
    detail: `${zip} needs manual approval, travel fee, or waitlist routing.`,
  };
}

function latestEventTicket(profile, eventState) {
  return profile.wallet?.eventTickets?.[0] || eventState.redemptions?.[0] || eventState.codes?.[0] || null;
}

export function buildConsumerTruthLayer({
  profile = readClientProfile(),
  booking = readLastBooking(),
  broadcasts = readAssignmentBroadcasts(),
  gfeQueue = readGfeRoutingQueue(),
  opsMessages = readOpsMessages(),
  supportThread = readSupportThread(),
  eventState = readEventPresales(),
  activity = readActivity(12),
} = {}) {
  const updatedAt = booking?.updatedAt || profile.updatedAt || nowIso();
  const zip = booking?.zip || extractZip(booking?.address || profile.defaultAddress || '');
  const zone = serviceableStatus(zip);
  const gfeRequirement = resolveGfeRequirement({
    ...(booking || {}),
    isNewClient: booking?.isNewClient,
    gfe: booking?.gfeRecord || booking?.gfe || profile.gfe,
    gfeExpiresAt: booking?.gfeExpiresAt || profile.gfe?.validUntil,
    visitCount: booking?.visitCount,
  });
  const clearance = evaluateClinicalClearance(booking || {}, { profile });
  const appointmentHeld = Boolean(booking?.datetime || booking?.date || booking?.time);
  const depositPaid = /paid/i.test(String(booking?.payment || profile.wallet?.deposits?.[0]?.status || ''));
  const intakeReady = booking?.intake === 'Done' || profile.documents?.some((doc) => doc.label === 'Intake' && /complete|signed/i.test(doc.status));
  const consentReady = booking?.consent === 'Done' || profile.documents?.some((doc) => doc.label === 'Consent' && /complete|signed/i.test(doc.status));
  const nurseAssigned = Boolean(booking?.nurse && booking.nurse !== 'Unassigned');
  const activeBroadcasts = broadcasts.filter((item) => item.status !== 'Assigned');
  const acceptedBroadcast = broadcasts.find((item) => item.status === 'Assigned') || null;
  const timeline = buildLiveVisitTimeline(booking);
  const currentStep = timeline.find((step) => step.active) || timeline.find((step) => step.done) || timeline[0];
  const gfeRoute = gfeQueue[0] || null;
  const addonCount = Array.isArray(booking?.addOns) ? booking.addOns.length : 0;
  const receipt = profile.wallet?.invoices?.[0] || null;
  const eventTicket = latestEventTicket(profile, eventState);
  const city = inferBookingCity(booking || {});
  const shiftValue = estimateShiftValue(booking || {});
  const latestOpsMessage = opsMessages[0] || null;
  const latestSupportMessage = supportThread[0] || null;
  const latestActivity = activity[0] || null;
  const gfeValidUntil = profile.gfe?.validUntil ? formatStamp(profile.gfe.validUntil) : 'No date';

  const modules = [
    module({
      key: 'appointment-status',
      group: 'Visit',
      label: 'Appointment status',
      value: booking?.status || 'No visit',
      status: booking ? 'Live' : 'Needed',
      owner: booking ? 'Avalon OS' : 'Client',
      detail: booking ? currentStep?.client || booking.nextStep || 'Visit record is active.' : 'No active booking record exists on this device.',
      nextAction: booking ? booking.nextStep || 'Wait for the next timestamped update.' : 'Start a visit request.',
      source: booking ? booking.reference || booking.id || 'Local booking record' : 'No local booking record',
      updatedAt,
      actionHref: booking ? '/members/dashboard' : '/book',
      actionLabel: booking ? 'View portal' : 'Book',
    }),
    module({
      key: 'deposit-ledger',
      group: 'Money',
      label: '$50 deposit',
      value: depositPaid ? 'Paid' : 'Pending',
      status: depositPaid ? 'Paid' : 'Action',
      owner: 'Checkout',
      detail: depositPaid ? 'Deposit is represented in the local wallet.' : 'Deposit is not marked paid until checkout returns a paid record.',
      nextAction: depositPaid ? 'Hold receipt for the visit ledger.' : 'Complete secure checkout.',
      source: profile.wallet?.deposits?.[0]?.id || booking?.reference || 'Local wallet',
      updatedAt,
      actionHref: '/checkout',
      actionLabel: 'Checkout',
    }),
    module({
      key: 'acuity-slot',
      group: 'Visit',
      label: 'Appointment status',
      value: appointmentHeld ? (booking?.holdType === 'fast' ? 'Requested' : 'Held') : 'No window',
      status: appointmentHeld ? 'Ready' : 'Needed',
      owner: 'Scheduling',
      detail: appointmentHeld ? [booking?.date, booking?.time].filter(Boolean).join(' - ') || booking?.datetime : 'No appointment window is represented locally.',
      nextAction: appointmentHeld ? 'Avalon confirms timing before dispatch.' : 'Choose a date and time.',
      source: booking?.appointmentTypeId || 'Local appointment field',
      updatedAt,
      actionHref: '/book',
      actionLabel: appointmentHeld ? 'Modify' : 'Schedule',
    }),
    module({
      key: 'service-zone',
      group: 'Location',
      label: 'Service zone',
      value: zone.value,
      status: zone.status,
      owner: 'Dispatch',
      detail: zone.detail,
      nextAction: zone.status === 'Ready' ? 'Dispatch can continue.' : 'Confirm city, ZIP, and travel approval.',
      source: zip || 'Address pending',
      updatedAt,
      actionHref: '/service-area',
      actionLabel: 'Coverage',
    }),
    module({
      key: 'intake',
      group: 'Clinical',
      label: 'Medical intake',
      value: intakeReady ? 'Complete' : 'Needed',
      status: intakeReady ? 'Ready' : 'Action',
      owner: 'Client',
      detail: intakeReady ? 'Profile, allergies, medications, and screening exist.' : 'Intake must be completed before clinical review.',
      nextAction: intakeReady ? 'Keep profile current.' : 'Finish intake.',
      source: 'Client profile',
      updatedAt: profile.updatedAt || updatedAt,
      actionHref: '/members/account',
      actionLabel: 'Profile',
    }),
    module({
      key: 'consent',
      group: 'Clinical',
      label: 'Consent',
      value: consentReady ? 'Signed' : 'Needed',
      status: consentReady ? 'Ready' : 'Action',
      owner: 'Client',
      detail: consentReady ? 'Treatment consent is represented in documents.' : 'Treatment, HIPAA, and liability acknowledgements are still required.',
      nextAction: consentReady ? 'No action unless protocol changes.' : 'Sign consent before treatment.',
      source: 'Document vault',
      updatedAt: profile.updatedAt || updatedAt,
      actionHref: '/members/account',
      actionLabel: 'Docs',
    }),
    module({
      key: 'gfe-status',
      group: 'Clinical',
      label: 'GFE status',
      value: gfeRequirement.required ? 'Required' : 'Valid',
      status: gfeRequirement.required ? 'Action' : 'Clear',
      owner: 'Clinical placeholder',
      detail: gfeRequirement.required ? gfeRequirement.reason : `Cleared through ${gfeValidUntil}.`,
      nextAction: gfeRequirement.required ? 'Complete GFE before RN dispatch.' : 'No GFE action needed.',
      source: profile.gfe?.source || 'Clinical placeholder',
      updatedAt: profile.updatedAt || updatedAt,
      actionHref: '/medical-direction',
      actionLabel: 'Clinical',
    }),
    module({
      key: 'gfe-route',
      group: 'Clinical',
      label: 'GFE route',
      value: gfeRoute ? gfeRoute.status : gfeRequirement.required ? 'NP first' : 'Clear',
      status: gfeRoute ? 'Live' : gfeRequirement.required ? 'Armed' : 'Clear',
      owner: 'Avalon NP first',
      detail: gfeRoute ? `${gfeRoute.destination?.name || gfeRoute.destination || 'Clinical'} owns review.` : 'Qualiphy is fallback only if no Avalon remote NP is on call.',
      nextAction: gfeRequirement.required ? 'Route to Avalon NP; fail over only when uncovered.' : 'No route needed.',
      source: gfeRoute?.id || 'GFE router',
      updatedAt: gfeRoute?.updatedAt || updatedAt,
    }),
    module({
      key: 'clinical-approval',
      group: 'Clinical',
      label: 'Clinical gate',
      value: clearance.dispatchAllowed ? 'Cleared' : clearance.label,
      status: clearance.status === 'blocked' ? 'Blocked' : clearance.dispatchAllowed ? 'Ready' : 'Action',
      owner: 'Clinical placeholder',
      detail: clearance.summary,
      nextAction: clearance.nextAction,
      source: 'Clinical placeholder engine',
      updatedAt,
    }),
    module({
      key: 'protocol-lock',
      group: 'Order',
      label: 'Protocol',
      value: booking?.service || 'Not selected',
      status: booking?.service ? 'Ready' : 'Needed',
      owner: 'Client',
      detail: booking?.service ? 'Selected protocol is tied to this visit record.' : 'No service selected.',
      nextAction: booking?.service ? 'Clinical source of record may adjust if needed.' : 'Choose recovery, protocol, or subscription.',
      source: booking?.protocolKey || 'Protocols',
      updatedAt,
      actionHref: '/protocols',
      actionLabel: 'Protocols',
    }),
    module({
      key: 'addons',
      group: 'Order',
      label: 'Add-ons',
      value: addonCount ? `${addonCount} added` : 'None',
      status: 'Editable',
      owner: 'Client',
      detail: addonCount ? booking.addOns.join(', ') : 'Add-ons can stay empty or be layered in before dispatch.',
      nextAction: 'Add or remove before the nurse prepares the kit.',
      source: 'Order record',
      updatedAt,
      actionHref: '/book',
      actionLabel: 'Edit',
    }),
    module({
      key: 'nurse-broadcast',
      group: 'Nurse',
      label: 'Shift offer',
      value: activeBroadcasts.length ? `${activeBroadcasts.length} live` : nurseAssigned ? 'Closed' : 'Armed',
      status: activeBroadcasts.length ? 'Live' : nurseAssigned ? 'Ready' : 'Armed',
      owner: 'Dispatch',
      detail: activeBroadcasts.length ? `Open in ${city}, worth $${shiftValue}.` : nurseAssigned ? 'Offer closed after nurse acceptance.' : 'Broadcast is ready when dispatch releases the shift.',
      nextAction: nurseAssigned ? 'Send client ETA.' : 'Offer to credential-clear nurses.',
      source: activeBroadcasts[0]?.id || 'Assignment broadcast',
      updatedAt: activeBroadcasts[0]?.updatedAt || updatedAt,
    }),
    module({
      key: 'nurse-credential',
      group: 'Nurse',
      label: 'RN credential',
      value: nurseAssigned ? 'Clear' : 'Nurseys gate',
      status: nurseAssigned ? 'Clear' : 'Armed',
      owner: 'Nurseys placeholder',
      detail: nurseAssigned ? `${booking.nurse} is represented as assigned.` : 'Only nurses passing credential filters should see/accept shifts.',
      nextAction: nurseAssigned ? 'Keep credential proof on file.' : 'Block non-clear nurses from acceptance.',
      source: 'Credential filter',
      updatedAt,
    }),
    module({
      key: 'nurse-accepted',
      group: 'Nurse',
      label: 'Nurse accepted',
      value: nurseAssigned ? booking.nurse : acceptedBroadcast?.acceptedBy || 'No',
      status: nurseAssigned || acceptedBroadcast ? 'Assigned' : 'Pending',
      owner: 'Field RN',
      detail: nurseAssigned ? 'Visit should now load to the nurse page.' : 'Client should see unassigned until a real nurse accepts.',
      nextAction: nurseAssigned ? 'Publish ETA and route.' : 'Continue Y/N offer loop.',
      source: acceptedBroadcast?.id || booking?.nurse || 'Assignment state',
      updatedAt: acceptedBroadcast?.updatedAt || updatedAt,
    }),
    module({
      key: 'eta',
      group: 'Nurse',
      label: 'ETA',
      value: nurseAssigned ? booking?.eta || 'Pending' : 'Locked',
      status: nurseAssigned ? (booking?.eta ? 'Live' : 'Pending') : 'After accept',
      owner: 'Field RN',
      detail: nurseAssigned ? 'ETA appears when nurse starts route.' : 'ETA is hidden until a real nurse accepts.',
      nextAction: nurseAssigned ? 'Route nurse and text client.' : 'Assign nurse first.',
      source: 'Route event',
      updatedAt,
    }),
    module({
      key: 'maps-route',
      group: 'Nurse',
      label: 'Map route',
      value: nurseAssigned ? 'Ready' : 'Locked',
      status: nurseAssigned ? 'Ready' : 'After accept',
      owner: 'Field RN',
      detail: nurseAssigned ? 'Apple/Google Maps handoff can open from nurse portal.' : 'Route stays locked until nurse acceptance.',
      nextAction: nurseAssigned ? 'Open route when shift starts.' : 'Assign nurse first.',
      source: booking?.address || 'No destination',
      updatedAt,
    }),
    module({
      key: 'client-text',
      group: 'Comms',
      label: 'Client text',
      value: latestOpsMessage?.status || 'Armed',
      status: latestOpsMessage ? 'Sent' : 'Armed',
      owner: 'Care team',
      detail: latestOpsMessage?.text || 'SMS placeholders are queued for GFE, nurse accepted, ETA, and follow-up.',
      nextAction: latestOpsMessage ? 'Watch delivery status.' : 'Send only real status updates.',
      source: latestOpsMessage?.id || 'Communication center',
      updatedAt: latestOpsMessage?.createdAt || updatedAt,
      actionHref: '/members/messages',
      actionLabel: 'Messages',
    }),
    module({
      key: 'support-thread',
      group: 'Comms',
      label: 'Support thread',
      value: supportThread.length ? `${supportThread.length} msgs` : 'Empty',
      status: supportThread.length ? 'Live' : 'Ready',
      owner: 'Care team',
      detail: latestSupportMessage?.text || 'Client can message care team from the portal.',
      nextAction: 'Keep every client-facing message in one log.',
      source: latestSupportMessage?.id || 'Support thread',
      updatedAt: latestSupportMessage?.createdAt || latestSupportMessage?.at || updatedAt,
      actionHref: '/members/messages',
      actionLabel: 'Open',
    }),
    module({
      key: 'membership-credits',
      group: 'Money',
      label: 'Membership credits',
      value: `${profile.subscription?.creditsAvailable ?? 0}/${profile.subscription?.creditsTotal ?? 0}`,
      status: profile.subscription?.status || 'Inactive',
      owner: 'Client wallet',
      detail: `${profile.subscription?.plan || 'No plan'} - renewal ${profile.subscription?.renewal || 'not set'}.`,
      nextAction: 'Redeem, pause, upgrade, or downgrade from account controls.',
      source: 'Subscription ledger',
      updatedAt: profile.updatedAt || updatedAt,
      actionHref: '/subscription',
      actionLabel: 'Plan',
    }),
    module({
      key: 'receipt',
      group: 'Money',
      label: 'Receipt',
      value: receipt?.status || 'Pending',
      status: receipt?.status || 'Action',
      owner: 'QuickBooks placeholder',
      detail: receipt ? `${receipt.label} ${receipt.amount || ''}`.trim() : 'Receipt should appear after deposit/payment is recorded.',
      nextAction: receipt ? 'Keep available in wallet.' : 'Generate invoice/receipt after payment.',
      source: receipt?.id || 'Wallet',
      updatedAt,
      actionHref: '/members/account',
      actionLabel: 'Wallet',
    }),
    module({
      key: 'launch-ticket',
      group: 'Launches',
      label: 'Launch ticket',
      value: eventTicket ? 'Stored' : 'None',
      status: eventTicket ? 'Ready' : 'No ticket',
      owner: 'Launches',
      detail: eventTicket ? `${eventTicket.event || eventTicket.code || eventTicket.credential} - ${eventTicket.status || 'active'}.` : 'Launch presales, guest intake, and QR redemption will appear here.',
      nextAction: eventTicket ? 'Complete launch GFE before launch day if required.' : 'Buy or redeem a launch presale.',
      source: eventTicket?.id || 'Launch wallet',
      updatedAt,
      actionHref: '/launches',
      actionLabel: 'Launches',
    }),
    module({
      key: 'aftercare',
      group: 'Care',
      label: 'Aftercare',
      value: /complete|follow/i.test(String(booking?.status || '')) ? 'Ready' : 'Queued',
      status: /complete|follow/i.test(String(booking?.status || '')) ? 'Ready' : 'Armed',
      owner: 'Care team',
      detail: 'Aftercare, visit close status, receipt, and rebook prompt unlock after the visit closes.',
      nextAction: /complete|follow/i.test(String(booking?.status || '')) ? 'Review aftercare and rebook.' : 'Complete visit first.',
      source: 'Visit closeout',
      updatedAt,
    }),
    module({
      key: 'audit-log',
      group: 'Trust',
      label: 'Audit log',
      value: activity.length ? `${activity.length} events` : 'Empty',
      status: activity.length ? 'Live' : 'Ready',
      owner: 'Avalon OS',
      detail: latestActivity?.text || 'Every meaningful state change should create a timestamped event.',
      nextAction: 'Keep status, timestamp, owner, and next action on every record.',
      source: latestActivity?.id || 'Local activity log',
      updatedAt: latestActivity?.at || updatedAt,
    }),
  ];

  return {
    count: modules.length,
    targetCount: REAL_BUILD_COUNT,
    complete: modules.length === REAL_BUILD_COUNT,
    booking,
    profile,
    modules,
    groups: modules.reduce((acc, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    }, {}),
    summary: {
      ready: modules.filter((item) => item.tone === 'ready').length,
      action: modules.filter((item) => item.tone === 'action').length,
      blocked: modules.filter((item) => item.tone === 'blocked').length,
      neutral: modules.filter((item) => item.tone === 'neutral').length,
    },
  };
}

export const CONSUMER_TRUTH_BUILD_COUNT = REAL_BUILD_COUNT;
