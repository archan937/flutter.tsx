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
  flutterRuns: [string[], string][];
}

const record = (overrides: Partial<InstallDeps> = {}): Recorded => {
  const reported: string[] = [];
  const fetched: string[] = [];
  const downloads: string[] = [];
  const replaced: { source: string; destination: string }[] = [];
  const written: SdkManifest[] = [];
  const flutterRuns: [string[], string][] = [];

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
    runFlutter: (args, cwd) => {
      flutterRuns.push([args, cwd]);
      return Promise.resolve(0);
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

  return {
    deps,
    reported,
    fetched,
    downloads,
    replaced,
    written,
    flutterRuns,
  };
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

const ENGINE_SOURCES = '/fsx/flutter/bin/cache/pkg/sky_engine/lib/ui/ui.dart';

describe('installSdk — leaving a usable SDK', () => {
  // Extracting the archive is not the whole job: the engine sources dart:ui
  // comes from live in the Flutter cache, which a download does not always
  // carry. An install that stops at extraction leaves an SDK that cannot
  // analyze or build until some later command happens to populate it.
  test('populates the cache when the engine sources are absent', async () => {
    const { deps, flutterRuns, reported } = record({
      pathExists: (path) => Promise.resolve(path !== ENGINE_SOURCES),
    });

    await installSdk(deps);

    expect(flutterRuns).toEqual([[['precache'], '/fsx/flutter']]);
    expect(reported.at(-1)).toBe('Populating the Flutter cache…');
  });

  test('leaves a cache that is already populated alone', async () => {
    const { deps, flutterRuns } = record();

    await installSdk(deps);

    expect(flutterRuns).toEqual([]);
  });

  test('completes an SDK that was installed before but never populated', async () => {
    const { deps, flutterRuns, downloads } = record({
      readManifest: () => Promise.resolve(installedManifest),
      pathExists: (path) => Promise.resolve(path !== ENGINE_SOURCES),
    });

    const result = await installSdk(deps);

    // Nothing is downloaded again; the SDK is only completed.
    expect(result.status).toBe('already-installed');
    expect(downloads).toEqual([]);
    expect(flutterRuns).toEqual([[['precache'], '/fsx/flutter']]);
  });

  test('reports a cache that could not be populated', () => {
    const { deps } = record({
      pathExists: (path) => Promise.resolve(path !== ENGINE_SOURCES),
      runFlutter: () => Promise.resolve(69),
    });

    expect(installSdk(deps)).rejects.toThrow(
      'flutter precache failed (exit 69) in /fsx/flutter.',
    );
  });
});
