#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const COVERAGE_THRESHOLD = 85;
const REPO_ROOT = process.cwd();

const stagedFiles = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const featureFiles = stagedFiles.filter(isFeaturePath);

if (featureFiles.length === 0) {
  console.log('No staged feature files matched the coverage gate. Skipping coverage threshold check.');
  process.exit(0);
}

const coverageRaw = readFileSync(path.join(REPO_ROOT, 'coverage', 'coverage-final.json'), 'utf8');
const coverage = JSON.parse(coverageRaw);

const failures = [];

for (const relativePath of featureFiles) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  const entry = coverage[absolutePath];

  if (!entry) {
    failures.push(`${relativePath}: no coverage data found`);
    continue;
  }

  const statements = summarize(entry.s);
  const branches = summarize(entry.b);
  const functions = summarize(entry.f);
  const lines = statements;

  const metrics = [
    ['statements', statements],
    ['branches', branches],
    ['functions', functions],
    ['lines', lines],
  ];

  const belowThreshold = metrics.filter(([, value]) => value < COVERAGE_THRESHOLD);
  if (belowThreshold.length > 0) {
    failures.push(
      `${relativePath}: ${belowThreshold.map(([name, value]) => `${name} ${value.toFixed(1)}%`).join(', ')}`
    );
  }
}

if (failures.length > 0) {
  console.error(`Coverage gate failed. Staged feature paths must meet ${COVERAGE_THRESHOLD}% coverage:`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Coverage gate passed for ${featureFiles.length} staged feature file(s).`);

function isFeaturePath(filePath) {
  if (!filePath.endsWith('.ts')) {
    return false;
  }

  if (!filePath.startsWith('src/')) {
    return false;
  }

  const excludedPrefixes = [
    'src/assets/',
    'src/config/',
    'src/contracts/',
    'src/commands/',
  ];

  if (excludedPrefixes.some((prefix) => filePath.startsWith(prefix))) {
    return false;
  }

  const excludedFiles = new Set([
    'src/cli.ts',
    'src/program.ts',
  ]);

  return !excludedFiles.has(filePath);
}

function summarize(metricMap) {
  const values = Object.values(metricMap ?? {});
  if (values.length === 0) {
    return 100;
  }

  let covered = 0;
  let total = 0;

  for (const value of values) {
    if (Array.isArray(value)) {
      for (const branchCount of value) {
        total += 1;
        if (Number(branchCount) > 0) {
          covered += 1;
        }
      }
      continue;
    }

    total += 1;
    if (Number(value) > 0) {
      covered += 1;
    }
  }

  return total === 0 ? 100 : (covered / total) * 100;
}
