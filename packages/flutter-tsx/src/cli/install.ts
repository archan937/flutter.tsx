import { homedir } from 'node:os';

import { type InstallDeps, installSdk } from '@src/sdk/install';
import {
  download,
  ensureDir,
  extract,
  fetchJson,
  isoNow,
  pathExists,
  remove,
  replaceDir,
} from '@src/sdk/io';
import {
  readManifest,
  resolveFsxPaths,
  writeManifest,
} from '@src/sdk/manifest';
import { resolveReleaseTarget } from '@src/sdk/platform';
import { FLUTTER_VERSION } from '@src/sdk/version';

const MEGABYTE = 1024 * 1024;

const megabytes = (bytes: number): string => (bytes / MEGABYTE).toFixed(1);

export const formatProgress = (
  received: number,
  total: number | null,
): string => {
  if (total === null) {
    return `${megabytes(received)} MB`;
  }
  const percent = Math.floor((received / total) * 100);
  return `${percent}% — ${megabytes(received)} of ${megabytes(total)} MB`;
};

export const renderLine = (text: string, tty: boolean): string =>
  tty ? `\r\u001B[2K${text}\n` : `${text}\n`;

export const writeLine = (text: string): void => {
  process.stdout.write(renderLine(text, process.stdout.isTTY));
};

export const writeProgress = (received: number, total: number | null): void => {
  process.stdout.write(`\r  ${formatProgress(received, total)}`);
};

export const runInstallCommand = async (
  overrides: Partial<InstallDeps> = {},
): Promise<void> => {
  await installSdk({
    paths: resolveFsxPaths(process.env, homedir()),
    target: resolveReleaseTarget(process.platform, process.arch),
    pinnedVersion: FLUTTER_VERSION,
    fetchJson,
    download,
    extract,
    pathExists,
    ensureDir,
    remove,
    replaceDir,
    readManifest,
    writeManifest,
    now: isoNow,
    report: writeLine,
    // Live progress redraws only make sense on an interactive terminal;
    // on CI/pipes they would flood the log with one line per chunk.
    ...(process.stdout.isTTY ? { onProgress: writeProgress } : {}),
    ...overrides,
  });
};
