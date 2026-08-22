import { basename, join } from 'node:path';

import type { FsxPaths, SdkManifest } from './manifest';
import type { ReleaseTarget } from './platform';
import {
  archiveUrl,
  parseReleasesIndex,
  releasesIndexUrl,
  selectRelease,
} from './releases';

export interface InstallDeps {
  paths: FsxPaths;
  target: ReleaseTarget;
  pinnedVersion: string;
  releasesBaseUrl: string;
  fetchJson: (url: string) => Promise<unknown>;
  download: (
    url: string,
    destination: string,
    onProgress?: (received: number, total: number | null) => void,
  ) => Promise<{ sha256: string }>;
  extract: (archivePath: string, destinationDir: string) => Promise<void>;
  pathExists: (path: string) => Promise<boolean>;
  ensureDir: (path: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
  replaceDir: (source: string, destination: string) => Promise<void>;
  readManifest: (path: string) => Promise<SdkManifest | null>;
  writeManifest: (path: string, manifest: SdkManifest) => Promise<void>;
  now: () => string;
  report: (message: string) => void;
  onProgress?: (received: number, total: number | null) => void;
}

export interface InstallResult {
  status: 'already-installed' | 'installed';
  version: string;
}

export const installSdk = async (deps: InstallDeps): Promise<InstallResult> => {
  const { paths, target, pinnedVersion } = deps;
  const flutterBinary = join(paths.sdkDir, 'bin', 'flutter');

  const manifest = await deps.readManifest(paths.manifestPath);
  if (
    manifest?.flutterVersion === pinnedVersion &&
    (await deps.pathExists(flutterBinary))
  ) {
    deps.report(
      `Flutter ${pinnedVersion} already installed at ${paths.sdkDir}`,
    );
    return { status: 'already-installed', version: pinnedVersion };
  }

  deps.report(
    `Resolving Flutter ${pinnedVersion} for ${target.os}-${target.arch}…`,
  );
  const index = parseReleasesIndex(
    await deps.fetchJson(releasesIndexUrl(target.os, deps.releasesBaseUrl)),
  );
  const release = selectRelease(index, {
    version: pinnedVersion,
    arch: target.arch,
  });

  const workDir = join(paths.tmpDir, `flutter-${pinnedVersion}`);
  await deps.remove(workDir);
  await deps.ensureDir(workDir);
  const archivePath = join(workDir, basename(release.archive));

  deps.report(`Downloading ${archiveUrl(index, release)}…`);
  const { sha256 } = await deps.download(
    archiveUrl(index, release),
    archivePath,
    deps.onProgress,
  );
  if (sha256 !== release.sha256) {
    throw new Error(
      `checksum mismatch for ${release.archive}: expected ${release.sha256}, got ${sha256}`,
    );
  }

  deps.report('Extracting…');
  await deps.extract(archivePath, workDir);
  const extractedSdk = join(workDir, 'flutter');
  if (!(await deps.pathExists(join(extractedSdk, 'bin', 'flutter')))) {
    throw new Error(
      `extracted archive has no flutter binary at ${extractedSdk}`,
    );
  }

  await deps.replaceDir(extractedSdk, paths.sdkDir);
  await deps.writeManifest(paths.manifestPath, {
    flutterVersion: pinnedVersion,
    archive: release.archive,
    sha256,
    installedAt: deps.now(),
  });
  await deps.remove(workDir);

  deps.report(`Flutter ${pinnedVersion} installed at ${paths.sdkDir}`);
  return { status: 'installed', version: pinnedVersion };
};
