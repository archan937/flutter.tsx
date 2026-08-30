import { homedir } from 'node:os';
import { join } from 'node:path';

import { createPluginExtractor } from '../plugins/extract';
import { syncProjectPlugins } from '../plugins/sync';
import { type InstallDeps, installSdk } from '../sdk/install';
import {
  commandRunner,
  download,
  ensureDir,
  extract,
  fetchJson,
  isoNow,
  pathExists,
  readTextFile,
  remove,
  replaceDir,
  runProcess,
  writeTextFile,
} from '../sdk/io';
import { readManifest, resolveFsxPaths, writeManifest } from '../sdk/manifest';
import { resolveReleaseTarget } from '../sdk/platform';
import { OFFICIAL_RELEASES_BASE_URL } from '../sdk/releases';
import { FLUTTER_VERSION } from '../sdk/version';

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

/**
 * The second half of `fsx install`: bringing the current project's plugins in
 * line with its package.json. Injected so the command can be driven without a
 * project on disk.
 */
export interface PluginPhase {
  projectDir: string;
  hasManifest: (projectDir: string) => Promise<boolean>;
  sync: (projectDir: string) => Promise<void>;
  out: (line: string) => void;
}

export const defaultPluginPhase = (): PluginPhase => {
  const paths = resolveFsxPaths(process.env, homedir());
  const flutterBin = join(paths.sdkDir, 'bin', 'flutter');
  const dartBin = join(paths.sdkDir, 'bin', 'dart');
  const extractorDir = new URL('../../extractor', import.meta.url).pathname;
  const cacheDir = join(paths.home, 'plugins');

  return {
    projectDir: process.cwd(),
    hasManifest: (projectDir) => pathExists(join(projectDir, 'package.json')),
    sync: (projectDir) =>
      syncProjectPlugins(projectDir, {
        readFile: readTextFile,
        writeFile: writeTextFile,
        removeFile: remove,
        pathExists,
        runFlutter: commandRunner(flutterBin),
        extractPlugin: createPluginExtractor({
          flutterBin,
          dartBin,
          dartSdkPath: join(paths.sdkDir, 'bin', 'cache', 'dart-sdk'),
          extractorDir,
          cacheDir,
          runProcess,
          pathExists,
          ensureDir,
        }),
        cacheDir,
        out: writeLine,
      }),
    out: writeLine,
  };
};

export const runInstallCommand = async (
  overrides: Partial<InstallDeps> = {},
  plugins: PluginPhase = defaultPluginPhase(),
): Promise<void> => {
  const paths = resolveFsxPaths(process.env, homedir());

  await installSdk({
    paths,
    target: resolveReleaseTarget(process.platform, process.arch),
    pinnedVersion: FLUTTER_VERSION,
    releasesBaseUrl: process.env.FSX_RELEASES_URL ?? OFFICIAL_RELEASES_BASE_URL,
    fetchJson,
    download,
    extract,
    pathExists,
    ensureDir,
    remove,
    replaceDir,
    runFlutter: commandRunner(join(paths.sdkDir, 'bin', 'flutter')),
    readManifest,
    writeManifest,
    now: isoNow,
    report: writeLine,
    // Live progress redraws only make sense on an interactive terminal;
    // on CI/pipes they would flood the log with one line per chunk.
    ...(process.stdout.isTTY ? { onProgress: writeProgress } : {}),
    ...overrides,
  });

  const { projectDir } = plugins;
  if (!(await plugins.hasManifest(projectDir))) {
    plugins.out(`No package.json in ${projectDir} — installed the SDK only.`);
    return;
  }
  await plugins.sync(projectDir);
};
