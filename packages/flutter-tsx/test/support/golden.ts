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

export const fixturesPackageConfigPath = join(
  fixturesDir,
  '.dart_tool',
  'package_config.json',
);

export const dartFormatCheck = (path: string): Promise<number> =>
  runCommand(
    [dartBin(), 'format', '--set-exit-if-changed', '--output=none', path],
    fixturesDir,
  );

export const flutterAnalyze = (): Promise<number> =>
  runCommand([flutterBin(), 'analyze', '--no-pub'], fixturesDir);
