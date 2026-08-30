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

// The extractor is a Dart package: on a clean checkout nothing has resolved
// its dependencies yet, and every step below would fail on missing imports.
// `pub get` is a no-op against a warm cache, so it runs unconditionally.
const RESOLVE: string[] = [dartBin, 'pub', 'get'];

const LINT_STEPS: string[][] = [
  RESOLVE,
  [dartBin, 'format', '--set-exit-if-changed', '.'],
  [dartBin, 'analyze', '--fatal-infos'],
];

const TEST_STEPS: string[][] = [
  RESOLVE,
  // The reporter GitHub Actions selects collapses failures behind a group;
  // expanded prints what actually failed, which is what a CI log is for.
  [dartBin, 'test', '--coverage=coverage', '--reporter=expanded'],
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

const flutterBin = join(paths.sdkDir, 'bin', 'flutter');

/**
 * The ground-truth tests analyze the framework's own sources, which need its
 * packages resolved — `flutter update-packages` writes that, and the SDK
 * documents it as a command for CI and repo maintainers. Populating the
 * engine cache is not done here: that is what makes an SDK usable at all, so
 * `fsx install` owns it.
 */
/**
 * Whether the SDK's package config maps the engine package. A downloaded SDK
 * can carry a config that resolves the framework and not sky_engine, which
 * reads later as `Could not load library dart:ui` — so the mapping is what is
 * checked, not the file.
 */
const mapsSkyEngine = async (packageConfig: string): Promise<boolean> => {
  const file = Bun.file(packageConfig);
  if (!(await file.exists())) {
    return false;
  }
  const parsed = (await file.json()) as { packages?: { name?: string }[] };
  return parsed.packages?.some((entry) => entry.name === 'sky_engine') === true;
};

const bootstrapSdk = async (): Promise<void> => {
  const packageConfig = join(paths.sdkDir, '.dart_tool', 'package_config.json');
  if (await mapsSkyEngine(packageConfig)) {
    return;
  }
  process.stdout.write('Resolving the Flutter SDK packages…\n');
  const exitCode = await runCommand(
    [flutterBin, 'update-packages'],
    paths.sdkDir,
  );
  if (exitCode !== 0) {
    process.stderr.write(
      `✖ flutter update-packages failed (exit ${exitCode}) in ${paths.sdkDir}\n`,
    );
    process.exit(exitCode);
  }
};

if (mode === 'test') {
  await bootstrapSdk();
}

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
