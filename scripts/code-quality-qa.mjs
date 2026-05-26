import {
  allMatches,
  exists,
  lineCount,
  lineOf,
  listFiles,
  printAudit,
  read,
  rel,
  scoreFrom,
} from './audit-utils.mjs';

const MAX = 1000;
const findings = [];
const deductions = [];
const add = (points, file, message, line) => {
  deductions.push({ points });
  findings.push({ file, line: line || lineOf(file, /./), message });
};

const sourceFiles = listFiles('src', (file) => /\.(js|jsx|ts|tsx)$/.test(file));
const pageFiles = sourceFiles.filter((file) => rel(file).startsWith('src/pages/'));
const libFiles = sourceFiles.filter((file) => rel(file).startsWith('src/lib/'));

const godFiles = sourceFiles
  .map((file) => ({ file: rel(file), lines: lineCount(rel(file)) }))
  .filter((item) => item.lines > 500)
  .sort((a, b) => b.lines - a.lines);
for (const item of godFiles.slice(0, 8)) {
  add(item.lines > 2000 ? 60 : 35, item.file, `God file has ${item.lines} lines; split by domain, route section, or hook.`, 1);
}

const longComponents = pageFiles
  .map((file) => ({ file: rel(file), lines: lineCount(rel(file)) }))
  .filter((item) => item.lines > 300)
  .sort((a, b) => b.lines - a.lines);
if (longComponents.length > 10) add(70, longComponents[0].file, `${longComponents.length} page components exceed 300 lines; component boundaries are still too coarse.`, 1);

const hasHealthcareContracts = exists('src/contracts/preApiContracts.ts');
if (!hasHealthcareContracts) add(90, 'jsconfig.json', 'Most application code is untyped JS/JSX; no TypeScript contract layer for healthcare workflows.', 1);
if (!exists('src/components/ErrorBoundary.jsx')) add(80, 'src/App.jsx', 'Global ErrorBoundary component is missing.');
else if (!/ErrorBoundary/.test(read('src/App.jsx'))) add(80, 'src/App.jsx', 'ErrorBoundary exists but does not wrap the app routes.', lineOf('src/App.jsx', 'Routes'));

const rawFetches = sourceFiles.flatMap((file) => allMatches(rel(file), /\bfetch\(/)).filter((match) => !match.file.startsWith('src/lib/'));
if (rawFetches.length > 8) add(55, rawFetches[0]?.file || 'src', `${rawFetches.length} raw fetch callsites outside shared clients; prefer domain hooks/services.`, rawFetches[0]?.line || 1);

const consoleFindings = sourceFiles
  .flatMap((file) => allMatches(rel(file), /console\.(log|debug|warn|error)/))
  .filter((match) => !/import\.meta\.env\??\.DEV|analytics/.test(match.text) && !/ErrorBoundary|analytics/.test(match.file));
if (consoleFindings.length) {
  for (const match of consoleFindings.slice(0, 8)) add(15, match.file, 'Console call can ship to production path; gate it or route through telemetry.', match.line);
}

const effectListeners = sourceFiles.flatMap((file) => allMatches(rel(file), /addEventListener|setInterval|setTimeout/));
const riskyEffects = effectListeners.filter((match) => {
  const text = read(match.file);
  const windowStart = Math.max(0, text.split(/\r?\n/).slice(0, match.line).join('\n').length - 700);
  const windowEnd = text.split(/\r?\n/).slice(0, match.line + 25).join('\n').length + 700;
  const snippet = text.slice(windowStart, windowEnd);
  return /useEffect/.test(snippet) && !/removeEventListener|clearInterval|clearTimeout|return\s*\(\)/.test(snippet);
});
for (const match of riskyEffects.slice(0, 5)) add(20, match.file, 'Effect creates listener/timer without obvious cleanup nearby.', match.line);

const duplicatedLocalStorage = libFiles.flatMap((file) => allMatches(rel(file), /localStorage\./));
if (duplicatedLocalStorage.length > 18) add(45, duplicatedLocalStorage[0].file, `${duplicatedLocalStorage.length} localStorage touches in lib layer; centralize storage boundaries for API migration.`, duplicatedLocalStorage[0].line);

const score = scoreFrom(MAX, deductions);
printAudit('CODE QUALITY', score, MAX, findings, {
  min: Number(process.env.CODE_QUALITY_QA_MIN || 0),
});
