import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();

export function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, '/');
}

export function read(file) {
  return fs.readFileSync(path.resolve(ROOT, file), 'utf8');
}

export function exists(file) {
  return fs.existsSync(path.resolve(ROOT, file));
}

export function listFiles(dir, matcher = () => true) {
  const root = path.resolve(ROOT, dir);
  const out = [];
  function walk(current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.git')) continue;
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (matcher(file)) out.push(file);
    }
  }
  walk(root);
  return out;
}

export function lineOf(file, pattern) {
  const text = read(file);
  const lines = text.split(/\r?\n/);
  const matcher = pattern instanceof RegExp
    ? (line) => pattern.test(line)
    : (line) => line.includes(pattern);
  const index = lines.findIndex(matcher);
  return index === -1 ? 1 : index + 1;
}

export function allMatches(file, pattern) {
  const text = read(file);
  return text.split(/\r?\n/).flatMap((line, index) => (
    pattern.test(line) ? [{ file, line: index + 1, text: line.trim() }] : []
  ));
}

export function tagMatches(file, tagName) {
  const text = read(file);
  const pattern = new RegExp(`<${tagName}\\b[\\s\\S]*?>`, 'g');
  const out = [];
  let match;
  while ((match = pattern.exec(text))) {
    const before = text.slice(0, match.index);
    out.push({
      file,
      line: before.split(/\r?\n/).length,
      text: match[0],
    });
  }
  return out;
}

export function countMatches(file, pattern) {
  return allMatches(file, pattern).length;
}

export function lineCount(file) {
  return read(file).split(/\r?\n/).length;
}

export function scoreFrom(max, deductions) {
  const score = Math.max(0, max - deductions.reduce((sum, item) => sum + item.points, 0));
  return Math.min(max, score);
}

export function printAudit(title, score, max, findings, { min = 0 } = {}) {
  console.log(`${title}: ${score}/${max}`);
  if (findings.length) {
    for (const finding of findings) {
      const loc = finding.file ? `${finding.file}:${finding.line || 1}` : 'global';
      console.log(`- ${loc} ${finding.message}`);
    }
  } else {
    console.log('- No material gaps found.');
  }
  if (score < min) {
    console.error(`${title} score ${score}/${max} is below minimum ${min}.`);
    process.exit(1);
  }
}
