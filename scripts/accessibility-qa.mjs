import {
  allMatches,
  lineOf,
  listFiles,
  printAudit,
  read,
  rel,
  scoreFrom,
  tagMatches,
} from './audit-utils.mjs';

const MAX = 500;
const findings = [];
const deductions = [];
const add = (points, file, message, line) => {
  deductions.push({ points });
  findings.push({ file, line: line || lineOf(file, /./), message });
};

const files = listFiles('src', (file) => /\.(jsx|js)$/.test(file)).map(rel);
const keyFiles = [
  'src/pages/BookNow.jsx',
  'src/pages/Checkout.jsx',
  'src/pages/Home.jsx',
  'src/pages/members/Dashboard.jsx',
  'src/pages/admin/Command.jsx',
  'src/components/landing/Navbar.jsx',
].filter((file) => files.includes(file));

const imageTags = files.flatMap((file) => tagMatches(file, 'img'));
const missingAlt = imageTags.filter((match) => !/\balt=/.test(match.text));
for (const match of missingAlt.slice(0, 8)) add(18, match.file, 'Image is missing alt text.', match.line);

const buttonLines = keyFiles.flatMap((file) => allMatches(file, /<button\b/));
const unlabeledIconButtons = buttonLines.filter((match) => {
  const line = match.text;
  return !/aria-label=|children=|>\s*[A-Za-z0-9]/.test(line) && /w-\[?\d|h-\[?\d|rounded-full|icon/i.test(line);
});
for (const match of unlabeledIconButtons.slice(0, 8)) add(16, match.file, 'Icon-style button may lack an accessible name.', match.line);

const modalFiles = files.filter((file) => /fixed inset|AnimatePresence|Dialog|Drawer|sheet/i.test(read(file)));
const modalWithoutDialogRole = modalFiles
  .filter((file) => /fixed inset-0/.test(read(file)) && !/role=["']dialog|aria-modal|role=["']status|DialogContent|SheetContent/.test(read(file)))
  .slice(0, 8);
for (const file of modalWithoutDialogRole.slice(0, 6)) {
  add(20, file, 'Custom modal/drawer pattern lacks obvious role="dialog"/aria-modal/focus trap.', lineOf(file, /fixed inset/));
}

const inputs = keyFiles.flatMap((file) => [
  ...tagMatches(file, 'input'),
  ...tagMatches(file, 'textarea'),
  ...tagMatches(file, 'select'),
]);
const unlabeledInputs = inputs.filter((match) => {
  const before = read(match.file).split(/\r?\n/).slice(Math.max(0, match.line - 5), match.line).join('\n');
  return !/aria-label=|id=/.test(match.text) && !/<label|label/i.test(before);
});
for (const match of unlabeledInputs.slice(0, 6)) add(18, match.file, 'Input may not have a programmatically connected label.', match.line);

const lowContrast = keyFiles.flatMap((file) => allMatches(file, /text-foreground\/(2[0-9]|3[0-9])|opacity-(2[0-9]|3[0-9])/));
if (lowContrast.length > 20) add(45, lowContrast[0].file, `${lowContrast.length} low-opacity text usages in key UX files; verify WCAG contrast for functional text.`, lowContrast[0].line);

const keyboardHandlers = files.flatMap((file) => allMatches(file, /onKeyDown|onKeyUp|tabIndex/));
if (keyboardHandlers.length < 8) add(35, 'src', 'Limited explicit keyboard support found for custom carousels, drawers, and command surfaces.', 1);

const reducedMotion = /prefers-reduced-motion/.test(read('src/index.css'));
if (!reducedMotion) add(35, 'src/index.css', 'Global prefers-reduced-motion handling is missing.');

const score = scoreFrom(MAX, deductions);
printAudit('ACCESSIBILITY', score, MAX, findings, {
  min: Number(process.env.ACCESSIBILITY_QA_MIN || 0),
});
