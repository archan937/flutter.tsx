import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { runCommand } from '@scripts/run-command';
import { resolveFsxPaths } from '@src/sdk/manifest';

export interface GoldenFixture {
  id: string;
  inputPath: string;
  expectedPath: string;
}

export const fixturesDir = new URL('../fixtures/', import.meta.url).pathname;

export const sweepPackageDir = new URL('../sweep/', import.meta.url).pathname;

export const listFixtures = async (): Promise<GoldenFixture[]> => {
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  const ids = entries
    .filter((entry) => entry.isDirectory() && /^\d+-/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  return ids.map((id) => ({
    id,
    inputPath: join(fixturesDir, id, 'input.tsx'),
    expectedPath: join(fixturesDir, id, 'expected.dart'),
  }));
};

export const flutterBin = (): string =>
  join(resolveFsxPaths(process.env, homedir()).sdkDir, 'bin', 'flutter');

const dartBin = (): string =>
  join(resolveFsxPaths(process.env, homedir()).sdkDir, 'bin', 'dart');

/**
 * Resolves a Dart package's dependencies. Unconditional on purpose: skipping
 * when `.dart_tool` happens to exist made the suite behave differently on a
 * machine that had run before than on a clean checkout — and made the coverage
 * gate depend on which of the two it was. `pub get` is a no-op against a warm
 * cache.
 */
export const ensurePackageResolved = async (
  packageDir: string,
  run: (command: string[], cwd: string) => Promise<number> = runCommand,
): Promise<void> => {
  const exitCode = await run([flutterBin(), 'pub', 'get'], packageDir);
  if (exitCode !== 0) {
    throw new Error(
      `flutter pub get failed (exit ${exitCode}) in ${packageDir}`,
    );
  }
};

export const dartFormatCheck = (path: string): Promise<number> =>
  runCommand(
    [dartBin(), 'format', '--set-exit-if-changed', '--output=none', path],
    fixturesDir,
  );

export const flutterAnalyze = (
  packageDir: string = fixturesDir,
): Promise<number> =>
  runCommand([flutterBin(), 'analyze', '--no-pub'], packageDir);
