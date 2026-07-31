#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const specDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec');
const versionFile = join(specDir, 'VERSION.md');

if (!existsSync(versionFile)) {
  console.error('[spec-version-check] FAIL: spec/VERSION.md does not exist — the specification corpus has no version declaration.');
  process.exit(1);
}

const text = readFileSync(versionFile, 'utf8');
const versionMatch = text.match(/\*\*Version:\*\*\s*(\d+\.\d+\.\d+)/);
const dateMatch = text.match(/\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})/);

if (!versionMatch || !dateMatch) {
  console.error('[spec-version-check] FAIL: spec/VERSION.md must declare "**Version:** x.y.z" and "**Last updated:** YYYY-MM-DD".');
  process.exit(1);
}

const declaredVersion = versionMatch[1];
const declaredDate = dateMatch[1];

function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else out.push(full);
  }
  return out;
}

const changed = [];
let newest = null;
for (const file of collectFiles(specDir)) {
  const mtime = statSync(file).mtime;
  if (!newest || mtime > newest.mtime) newest = { file, mtime };
  if (mtime.toISOString().slice(0, 10) > declaredDate) {
    changed.push({ file, date: mtime.toISOString().slice(0, 10) });
  }
}

if (changed.length > 0) {
  console.error(
    `[spec-version-check] FAIL: spec corpus changed after the declared version date (${declaredDate}) without a version bump (declared version ${declaredVersion}):`
  );
  for (const { file, date } of changed) {
    console.error(`  - ${relative(process.cwd(), file)} (modified ${date})`);
  }
  process.exit(1);
}

const newestLabel = newest ? newest.mtime.toISOString().slice(0, 10) : 'n/a';
console.log(`[spec-version-check] OK: spec corpus version ${declaredVersion} (last updated ${declaredDate}) covers all spec files; newest change ${newestLabel}.`);
process.exit(0);
