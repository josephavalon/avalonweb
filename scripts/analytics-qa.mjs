import {
  allMatches,
  lineOf,
  listFiles,
  printAudit,
  read,
  rel,
  scoreFrom,
} from './audit-utils.mjs';

const MAX = 300;
const findings = [];
const deductions = [];
const add = (points, file, message, line) => {
  deductions.push({ points });
  findings.push({ file, line: line || lineOf(file, /./), message });
};

const analyticsFile = 'src/lib/analytics.js';
const analytics = read(analyticsFile);
const sourceFiles = listFiles('src', (file) => /\.(js|jsx)$/.test(file)).map(rel);

if (!/setProvider/.test(analytics)) add(25, analyticsFile, 'Analytics provider injection hook is missing.');
if (!/let\s+provider\s*=/.test(analytics)) add(20, analyticsFile, 'Provider state is not explicit.');
if (/provider\s*=\s*null/.test(analytics)) add(55, analyticsFile, 'No production analytics destination is connected yet; events queue silently until provider wiring.', lineOf(analyticsFile, 'provider = null'));
if (!/QUEUE_CAP/.test(analytics)) add(20, analyticsFile, 'Analytics queue cap is missing.');
if (!/No PII|PII/.test(analytics)) add(20, analyticsFile, 'No explicit PII policy in analytics layer.');

const trackCalls = sourceFiles.flatMap((file) => allMatches(file, /\btrack\(/));
if (trackCalls.length < 8) add(45, trackCalls[0]?.file || 'src/lib/analytics.js', `Only ${trackCalls.length} track() callsites found; booking funnel coverage is thin.`, trackCalls[0]?.line || 1);

const bookingFiles = ['src/pages/BookNow.jsx', 'src/pages/Checkout.jsx', 'src/pages/BookingConfirmation.jsx'].filter((file) => sourceFiles.includes(file));
for (const file of bookingFiles) {
  const text = read(file);
  if (!/\btrack\(/.test(text)) add(22, file, 'Booking funnel page has no explicit analytics events.', 1);
}

const events = ['step_viewed', 'step_completed', 'booking_confirmed', 'checkout_started', 'checkout_failed'];
for (const event of events) {
  if (!sourceFiles.some((file) => read(file).includes(event))) {
    add(12, analyticsFile, `Missing canonical funnel event: ${event}.`, 1);
  }
}

if (!sourceFiles.some((file) => /utm_|URLSearchParams\(.*utm|searchParams.*utm/i.test(read(file)))) {
  add(35, 'src', 'UTM capture/persistence is not implemented.', 1);
}
if (!sourceFiles.some((file) => /experiment|variant|abTest|splitTest/i.test(read(file)))) {
  add(25, 'src', 'No A/B or experiment assignment infrastructure found.', 1);
}

const score = scoreFrom(MAX, deductions);
printAudit('ANALYTICS', score, MAX, findings, {
  min: Number(process.env.ANALYTICS_QA_MIN || 0),
});
