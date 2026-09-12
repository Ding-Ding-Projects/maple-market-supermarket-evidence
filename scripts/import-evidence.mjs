import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const targetRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(process.argv[2] ?? 'C:/Users/cntow/Documents/GitHub/maple-market-supermarket');
const sourceRoots = [
  path.join(sourceRoot, 'docs', 'screenshots'),
  path.join(sourceRoot, 'assets', 'native-proofs', 'publication-20260911'),
];
const imageRoot = path.join(targetRoot, 'docs', 'images');
const outputPath = path.join(targetRoot, 'docs', 'provenance.json');
const dryRun = process.argv.includes('--dry-run');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const blocked = /restroom|\broom\b|caller|credential|password|token|account|transaction|diagnostic|private|operational|card-return|receipt|urinal|bathroom|wc\b/i;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else if (imageExtensions.has(path.extname(entry.name).toLowerCase())) result.push(full);
  }
  return result;
}

function safeId(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function titleFor(relative) {
  return relative.replace(/\.[^.]+$/, '').replace(/[\\/_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function categoryFor(relative) {
  const lower = relative.toLowerCase();
  if (lower.includes('model')) return 'authored-model';
  if (lower.includes('material')) return 'materials';
  if (lower.includes('transit') || lower.includes('toronto') || lower.includes('quarry')) return 'districts-and-transit';
  if (lower.includes('arcade')) return 'arcade';
  if (lower.includes('office')) return 'office';
  return 'construction';
}

async function receiptFor(imagePath) {
  const candidate = path.join(path.dirname(imagePath), `${path.basename(imagePath, path.extname(imagePath))}.json`);
  try {
    const text = await fs.readFile(candidate, 'utf8');
    const parsed = JSON.parse(text);
    if (!parsed.privacy && !parsed.inspection && !parsed.evidenceClass && !parsed.captures) return null;
    return { parsed, serialized: JSON.stringify(parsed), path: candidate };
  } catch {
    return null;
  }
}

const images = (await Promise.all(sourceRoots.map(async (root) => {
  try { return await walk(root); } catch { return []; }
}))).flat();
const selected = [];
const excluded = [];
for (const imagePath of images) {
  const sourceBase = sourceRoots.find((root) => imagePath === root || imagePath.startsWith(`${root}${path.sep}`));
  const relative = path.relative(sourceBase ?? sourceRoot, imagePath).replaceAll('\\', '/');
  const sourceLabel = path.relative(sourceRoot, imagePath).replaceAll('\\', '/');
  const receipt = await receiptFor(imagePath);
  if (blocked.test(relative) || blocked.test(receipt?.serialized ?? '')) {
    excluded.push({ file: sourceLabel, reason: 'privacy-or-diagnostic-boundary' });
    continue;
  }
  if (!receipt) {
    excluded.push({ file: sourceLabel, reason: 'no-local-capture-receipt' });
    continue;
  }
  const bytes = (await fs.stat(imagePath)).size;
  const hash = crypto.createHash('sha256').update(await fs.readFile(imagePath)).digest('hex').toUpperCase();
  selected.push({
    source: sourceLabel,
    file: `images/${safeId(relative.replace(/\.[^.]+$/, ''))}${path.extname(imagePath).toLowerCase()}`,
    id: safeId(relative.replace(/\.[^.]+$/, '')),
    title: titleFor(relative),
    category: categoryFor(relative),
    tag: categoryFor(relative).replaceAll('-', ' '),
    caption: 'Verified Maple Market construction evidence. This image does not claim a complete published experience or full runtime acceptance.',
    sha256: hash,
    bytes,
    receipt: path.relative(sourceRoot, receipt.path).replaceAll('\\', '/'),
    evidenceClass: receipt.parsed.evidenceClass ?? 'Inspected construction capture',
    sourceRevision: receipt.parsed.sourceCommit ?? receipt.parsed.sourceRevision ?? 'working source, exact commit not recorded in receipt',
  });
}

const publicationImages = [
  'assets/native-proofs/publication-20260911/glass-route-overview.jpg',
  'assets/native-proofs/publication-20260911/glass-vestibule-before-hinged-retirement.jpg',
  'assets/native-proofs/publication-20260911/modeled-checkout-A.jpg',
  'assets/native-proofs/publication-20260911/modeled-screen-clear.jpg',
];
for (const sourceLabel of publicationImages) {
  const imagePath = path.join(sourceRoot, sourceLabel);
  try {
    const bytes = (await fs.stat(imagePath)).size;
    const hash = crypto.createHash('sha256').update(await fs.readFile(imagePath)).digest('hex').toUpperCase();
    selected.push({
      source: sourceLabel,
      file: `images/${safeId(path.basename(sourceLabel, path.extname(sourceLabel)))}${path.extname(sourceLabel).toLowerCase()}`,
      id: safeId(path.basename(sourceLabel, path.extname(sourceLabel))),
      title: titleFor(path.basename(sourceLabel)),
      category: 'construction',
      tag: 'construction',
      caption: 'Verified Maple Market construction evidence from the reviewed publication set. This image does not claim a complete published experience or full runtime acceptance.',
      sha256: hash,
      bytes,
      receipt: 'assets/native-proofs/publication-20260911/inventory.json',
      evidenceClass: 'Reviewed Studio construction capture',
      sourceRevision: 'a81fdff05254f0d303fa407d3e24fe946e0ad87c',
    });
  } catch {
    excluded.push({ file: sourceLabel, reason: 'publication-capture-missing' });
  }
}

const unique = new Map();
for (const item of selected) if (!unique.has(item.sha256)) unique.set(item.sha256, item);
const captures = [...unique.values()].sort((a, b) => a.file.localeCompare(b.file));
const provenance = {
  schemaVersion: 2,
  version: '0.4.0-preview',
  updatedAt: new Date().toISOString(),
  sourceRepository: 'Ding-Ding-Projects/maple-market-supermarket',
  sourceRevision: 'a81fdff05254f0d303fa407d3e24fe946e0ad87c',
  verificationState: 'public-safe-construction-evidence-only',
  privacyReview: 'Only receipt-backed images that pass the public safety review are included.',
  captures,
  excludedCount: excluded.length,
};

if (dryRun) {
  console.log(JSON.stringify({ selected: captures.length, excluded: excluded.length, bytes: captures.reduce((sum, item) => sum + item.bytes, 0), sample: captures.slice(0, 5) }, null, 2));
  process.exit(0);
}

await fs.rm(imageRoot, { recursive: true, force: true });
await fs.mkdir(imageRoot, { recursive: true });
for (const item of captures) await fs.copyFile(path.join(sourceRoot, item.source), path.join(targetRoot, 'docs', item.file));
await fs.writeFile(outputPath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');
console.log(`Imported ${captures.length} public-safe captures and excluded ${excluded.length} files.`);
