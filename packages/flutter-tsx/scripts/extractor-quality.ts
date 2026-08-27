import { homedir } from 'node:os';
import { join } from 'node:path';

import { coverageFailures, parseLcov } from '@scripts/lcov';
import { runCommand } from '@scripts/run-command';
import { resolveFsxPaths } from '@src/sdk/manifest';

const paths = resolveFsxPaths(process.env, homedir());
const dartBin = join(paths.sdkDir, 'bin', 'dart');
const extractorDir = new URL('../extractor', import.meta.url).pathname;

// Split so the whole gate runs its seconds-long checks before any test suite:
// a Dart formatting nit must never cost a full TypeScript test run first.
const mode = process.argv[2] === 'lint' ? 'lint' : 'test';

const LINT_STEPS: string[][] = [
  [dartBin, 'format', '--set-exit-if-changed', '.'],
  [dartBin, 'analyze', '--fatal-infos'],
];

const TEST_STEPS: string[][] = [
  [dartBin, 'test', '--coverage=coverage'],
  [
    dartBin,
    'run',
    'coverage:format_coverage',
    '--lcov',
    '--in=coverage',
    '--out=coverage/lcov.info',
    '--report-on=lib',
  ],
];

for (const step of mode === 'lint' ? LINT_STEPS : TEST_STEPS) {
  const exitCode = await runCommand(step, extractorDir);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

if (mode === 'lint') {
  process.stdout.write('✓ extractor lint: dart format + analyze clean\n');
  process.exit(0);
}

const lcovContent = await Bun.file(
  join(extractorDir, 'coverage', 'lcov.info'),
).text();
const files = parseLcov(lcovContent);
const failures = coverageFailures(files);

if (failures.length > 0) {
  process.stderr.write(
    `✖ extractor coverage gate — below 100%:\n${failures
      .map((failure) => `  ${failure}`)
      .join('\n')}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `✓ extractor coverage gate: ${files.length} lib files at 100% lines\n`,
);
