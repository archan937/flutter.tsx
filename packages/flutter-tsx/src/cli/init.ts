import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import {
  commandRunner,
  pathExists as fileExists,
  writeTextFile,
} from '../sdk/io';
import { resolveFsxPaths } from '../sdk/manifest';
import { DEFAULT_SCAFFOLD_VERSION, scaffoldFiles } from './scaffold';

export interface InitDeps {
  sdkInstalled: () => Promise<boolean>;
  pathExists: (path: string) => Promise<boolean>;
  writeFile: (path: string, contents: string) => Promise<void>;
  runFlutter: (args: string[], cwd: string) => Promise<number>;
  out: (line: string) => void;
}

const DEFAULT_ORG = 'dev.fluttertsx';

const FALLBACK_PACKAGE_NAME = 'app';

/**
 * Dart package names are lower_snake_case and cannot start with a digit, so
 * the target's own directory name — never the path leading to it — is
 * normalised rather than rejected.
 */
export const packageNameFrom = (directory: string): string => {
  const cleaned = basename(resolve(directory))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (cleaned === '') return FALLBACK_PACKAGE_NAME;
  return /^[0-9]/.test(cleaned) ? `app_${cleaned}` : cleaned;
};

export const runInitCommand = async (
  directory: string,
  deps: InitDeps,
): Promise<void> => {
  if (!(await deps.sdkInstalled())) {
    throw new Error(
      'the Flutter SDK is not installed — run `fsx install` first.',
    );
  }
  const manifestPath = join(directory, 'package.json');
  if (await deps.pathExists(manifestPath)) {
    throw new Error(
      `${manifestPath} already exists — run fsx init in an empty directory.`,
    );
  }

  const name = packageNameFrom(directory);
  for (const file of scaffoldFiles({
    name,
    bundleId: `${DEFAULT_ORG}.${name.replace(/_/g, '')}`,
    version: DEFAULT_SCAFFOLD_VERSION,
  })) {
    await deps.writeFile(`${directory}/${file.path}`, file.contents);
  }

  // The host app lives in the project itself, so the Flutter tooling works
  // there directly — the same shape the e2e harness has proven all along.
  const created = await deps.runFlutter(
    [
      'create',
      '--platforms',
      'web',
      '--project-name',
      name,
      '--org',
      DEFAULT_ORG,
      '.',
    ],
    directory,
  );
  if (created !== 0) {
    throw new Error(`flutter create failed (exit ${created}) in ${directory}.`);
  }

  deps.out(`Created ${directory}. Next: cd ${directory} && bun install`);
};

export const defaultInitDeps = (): InitDeps => {
  const flutterBin = join(
    resolveFsxPaths(process.env, homedir()).sdkDir,
    'bin',
    'flutter',
  );
  return {
    sdkInstalled: () => fileExists(flutterBin),
    pathExists: fileExists,
    writeFile: writeTextFile,
    runFlutter: commandRunner(flutterBin),
    out: (line): void => {
      process.stdout.write(`${line}\n`);
    },
  };
};
