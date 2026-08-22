import { homedir } from 'node:os';
import { join } from 'node:path';

import { coverageFailures, parseLcov } from '@scripts/lcov';
import { runCommand } from '@scripts/run-command';
import { resolveFsxPaths } from '@src/sdk/manifest';

const paths = resolveFsxPaths(process.env, homedir());
const dartBin = join(paths.sdkDir, 'bin', 'dart');
const extractorDir = new URL('../extractor', import.meta.url).pathname;

const steps: string[][] = [
  [dartBin, 'format', '--set-exit-if-changed', '.'],
  [dartBin, 'analyze', '--fatal-infos'],
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

for (const step of steps) {
  const exitCode = await runCommand(step, extractorDir);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
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
