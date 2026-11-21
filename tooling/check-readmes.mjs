#!/usr/bin/env node
// CI guard: a pull request that changes a package's src/ or package.json must also
// change that package's README.md. Usage: node tooling/check-readmes.mjs origin/main
// Bypass with "no-doc-impact: <reason>" in the PR description (env PR_BODY).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.argv[2] ?? 'origin/main';
if (/(^|\n)\s*no-doc-impact:\s*\S/i.test(process.env.PR_BODY ?? '')) {
  console.log('readme check skipped: no-doc-impact declared');
  process.exit(0);
}
const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`]).toString().split('\n').filter(Boolean);
const dirs = new Set();
for (const dir of ['apps', 'packages']) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (fs.existsSync(`${dir}/${name}/package.json`)) dirs.add(`${dir}/${name}`);
  }
}
const missing = [...dirs].filter(
  (d) => changed.some((f) => f.startsWith(`${d}/src/`) || f === `${d}/package.json`) && !changed.includes(`${d}/README.md`),
);
if (missing.length) {
  console.error('These packages changed but their README.md did not:');
  for (const d of missing) console.error('  - ' + d);
  process.exit(1);
}
console.log('readme check ok');
