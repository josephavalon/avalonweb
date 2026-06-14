import {
  allMatches,
  exists,
  lineOf,
  listFiles,
  printAudit,
  read,
  rel,
  scoreFrom,
} from './audit-utils.mjs';

const MAX = 800;
const findings = [];
const deductions = [];
const add = (points, file, message, line) => {
  deductions.push({ points });
  findings.push({ file, line: line || lineOf(file, /./), message });
};

const tailwindFile = 'tailwind.config.js';
const cssFile = 'src/index.css';
const tailwind = exists(tailwindFile) ? read(tailwindFile) : '';
const css = exists(cssFile) ? read(cssFile) : '';

if (!/colors:\s*\{/.test(tailwind)) add(80, tailwindFile, 'Tailwind color tokens are missing.');
if (!/fontSize:\s*\{/.test(tailwind)) add(45, tailwindFile, 'Typography scale tokens are missing.');
if (!/spacing:\s*\{/.test(tailwind)) add(45, tailwindFile, 'Spacing rhythm tokens are missing.');
if (!/--background|--foreground|--accent/.test(css)) add(70, cssFile, 'CSS design tokens are missing.');

const uiRequired = ['button.jsx', 'card.jsx', 'badge.jsx', 'dialog.jsx', 'drawer.jsx', 'input.jsx', 'textarea.jsx', 'toast.jsx'];
for (const name of uiRequired) {
  if (!exists(`src/components/ui/${name}`)) add(30, `src/components/ui/${name}`, 'Reusable UI primitive is missing.', 1);
}

const jsxFiles = listFiles('src', (file) => /\.(jsx|js)$/.test(file)).map(rel);
const hardcodedHex = jsxFiles
  .flatMap((file) => allMatches(file, /#[0-9a-fA-F]{3,8}(?![-\w])/))
  .filter((match) => !match.file.includes('data/') && !match.file.includes('ProtocolIcons'));
if (hardcodedHex.length > 40) {
  add(80, hardcodedHex[0].file, `${hardcodedHex.length} hardcoded hex colors in JSX; move repeated colors to theme tokens.`, hardcodedHex[0].line);
  for (const match of hardcodedHex.slice(1, 6)) add(8, match.file, 'Hardcoded hex color bypasses design tokens.', match.line);
}

const arbitrarySpacing = jsxFiles
  .flatMap((file) => allMatches(file, /\b(p|px|py|m|mx|my|gap|w|h|top|bottom|left|right)-\[[^\]]+\]/))
  .filter((match) => !match.file.includes('ui/'));
if (arbitrarySpacing.length > 100) add(60, arbitrarySpacing[0].file, `${arbitrarySpacing.length} arbitrary Tailwind values outside primitives; standardize recurring dimensions.`, arbitrarySpacing[0].line);

const motionDurations = jsxFiles.flatMap((file) => allMatches(file, /duration:\s*0\.\d+|duration-\[|duration-\d+/));
if (motionDurations.length > 80) add(35, motionDurations[0].file, `${motionDurations.length} one-off animation durations; prefer shared motion tokens/easing.`, motionDurations[0].line);

const pageHeadingPatterns = [
  'font-heading text-5xl',
  'font-heading text-6xl',
  'text-display',
  'text-h1',
];
const pages = ['src/pages/Home.jsx', 'src/pages/BookNow.jsx', 'src/pages/Checkout.jsx', 'src/pages/Membership.jsx'].filter(exists);
const pagesWithoutTokenHeadings = pages.filter((file) => {
  const text = read(file);
  if (/<Hero\b/.test(text)) return false;
  return !pageHeadingPatterns.some((pattern) => text.includes(pattern));
});
for (const file of pagesWithoutTokenHeadings) add(20, file, 'Page does not appear to use shared heading scale classes.', 1);

const score = scoreFrom(MAX, deductions);
printAudit('DESIGN SYSTEM', score, MAX, findings, {
  min: Number(process.env.DESIGN_SYSTEM_QA_MIN || 0),
});
