import { describe, expect, test } from 'bun:test';

import { type InstallDeps, installSdk } from '@src/sdk/install';
import type { SdkManifest } from '@src/sdk/manifest';

const BASE_URL =
  'https://storage.googleapis.com/flutter_infra_release/releases';
const ARCHIVE = 'stable/macos/flutter_macos_arm64_3.47.1-stable.zip';
const SHA256 = 'expected-sha';

const releasesPayload = {
  base_url: BASE_URL,
  releases: [
    {
      hash: 'hash-a',
      channel: 'stable',
      version: '3.47.1',
      dart_sdk_arch: 'arm64',
      archive: ARCHIVE,
      sha256: SHA256,
    },
  ],
};

interface Recorded {
  deps: InstallDeps;
  reported: string[];
  fetched: string[];
  downloads: string[];
  replaced: { source: string; destination: string }[];
  written: SdkManifest[];
}

const record = (overrides: Partial<InstallDeps> = {}): Recorded => {
  const reported: string[] = [];
  const fetched: string[] = [];
  const downloads: string[] = [];
  const replaced: { source: string; destination: string }[] = [];
  const written: SdkManifest[] = [];

  const deps: InstallDeps = {
    paths: {
      home: '/fsx',
      sdkDir: '/fsx/flutter',
      manifestPath: '/fsx/sdk-manifest.json',
      tmpDir: '/fsx/tmp',
    },
    target: { os: 'macos', arch: 'arm64' },
    pinnedVersion: '3.47.1',
    releasesBaseUrl: BASE_URL,
    fetchJson: (url) => {
      fetched.push(url);
      return Promise.resolve(releasesPayload);
    },
    download: (url) => {
      downloads.push(url);
      return Promise.resolve({ sha256: SHA256 });
    },
    extract: () => Promise.resolve(),
    pathExists: () => Promise.resolve(true),
    ensureDir: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    replaceDir: (source, destination) => {
      replaced.push({ source, destination });
      return Promise.resolve();
    },
    readManifest: () => Promise.resolve(null),
    writeManifest: (_path, manifest) => {
      written.push(manifest);
      return Promise.resolve();
    },
    now: () => '2026-08-23T00:00:00.000Z',
    report: (message) => {
      reported.push(message);
    },
    ...overrides,
  };

  return { deps, reported, fetched, downloads, replaced, written };
};

const installedManifest: SdkManifest = {
  flutterVersion: '3.47.1',
  archive: ARCHIVE,
  sha256: SHA256,
  installedAt: '2026-08-20T00:00:00.000Z',
};

describe('installSdk', () => {
  test('performs a fresh install end to end', async () => {
    const { deps, reported, fetched, downloads, replaced, written } = record();

    const result = await installSdk(deps);

    expect(result).toEqual({ status: 'installed', version: '3.47.1' });
    expect(fetched).toEqual([`${BASE_URL}/releases_macos.json`]);
    expect(downloads).toEqual([`${BASE_URL}/${ARCHIVE}`]);
    expect(replaced).toEqual([
      {
        source: '/fsx/tmp/flutter-3.47.1/flutter',
        destination: '/fsx/flutter',
      },
    ]);
    expect(written).toEqual([
      {
        flutterVersion: '3.47.1',
        archive: ARCHIVE,
        sha256: SHA256,
        installedAt: '2026-08-23T00:00:00.000Z',
      },
    ]);
    expect(reported).toEqual([
      'Resolving Flutter 3.47.1 for macos-arm64…',
      `Downloading ${BASE_URL}/${ARCHIVE}…`,
      'Extracting…',
      'Flutter 3.47.1 installed at /fsx/flutter',
    ]);
  });

  test('short-circuits when the pinned version is already installed', async () => {
    const { deps, downloads, reported } = record({
      readManifest: () => Promise.resolve(installedManifest),
    });

    const result = await installSdk(deps);

    expect(result).toEqual({ status: 'already-installed', version: '3.47.1' });
    expect(downloads).toEqual([]);
    expect(reported).toEqual([
      'Flutter 3.47.1 already installed at /fsx/flutter',
    ]);
  });

  test('reinstalls when the manifest records a different version', async () => {
    const { deps, downloads } = record({
      readManifest: () =>
        Promise.resolve({ ...installedManifest, flutterVersion: '3.0.0' }),
    });

    const result = await installSdk(deps);

    expect(result.status).toBe('installed');
    expect(downloads).toHaveLength(1);
  });

  test('reinstalls when the manifest matches but the binary is gone', async () => {
    const { deps, downloads } = record({
      readManifest: () => Promise.resolve(installedManifest),
      pathExists: (path) =>
        Promise.resolve(path !== '/fsx/flutter/bin/flutter'),
    });

    const result = await installSdk(deps);

    expect(result.status).toBe('installed');
    expect(downloads).toHaveLength(1);
  });

  test('rejects a checksum mismatch', () => {
    const { deps } = record({
      download: () => Promise.resolve({ sha256: 'tampered' }),
    });

    expect(installSdk(deps)).rejects.toThrow(
      `checksum mismatch for ${ARCHIVE}: expected ${SHA256}, got tampered`,
    );
  });

  test('rejects an archive that contains no flutter binary', () => {
    const { deps } = record({
      pathExists: (path) =>
        Promise.resolve(!path.startsWith('/fsx/tmp/flutter-3.47.1/flutter')),
    });

    expect(installSdk(deps)).rejects.toThrow(
      'extracted archive has no flutter binary at /fsx/tmp/flutter-3.47.1/flutter',
    );
  });
});
