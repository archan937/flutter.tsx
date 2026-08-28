import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  defaultPluginPhase,
  formatProgress,
  renderLine,
  runInstallCommand,
  writeLine,
  writeProgress,
} from '@src/cli/install';
import type { InstallDeps } from '@src/sdk/install';

const MEGABYTE = 1024 * 1024;

describe('formatProgress', () => {
  test('renders percentage and sizes when the total is known', () => {
    expect(formatProgress(52.4288 * MEGABYTE, 100 * MEGABYTE)).toBe(
      '52% — 52.4 of 100.0 MB',
    );
  });

  test('renders received size alone when the total is unknown', () => {
    expect(formatProgress(1.5 * MEGABYTE, null)).toBe('1.5 MB');
  });
});

describe('renderLine', () => {
  test('clears the in-place progress line on a TTY', () => {
    expect(renderLine('done', true)).toBe('\r\u001B[2Kdone\n');
  });

  test('emits plain lines when piped', () => {
    expect(renderLine('done', false)).toBe('done\n');
  });
});

describe('writeLine / writeProgress', () => {
  test('write to stdout without throwing', () => {
    expect(() => {
      writeProgress(MEGABYTE, 2 * MEGABYTE);
      writeLine('fsx test line');
    }).not.toThrow();
  });
});

describe('runInstallCommand', () => {
  test('wires defaults and honors overrides end to end', async () => {
    const reported: string[] = [];
    const progressed: [number, number | null][] = [];

    const overrides: Partial<InstallDeps> = {
      paths: {
        home: '/fsx',
        sdkDir: '/fsx/flutter',
        manifestPath: '/fsx/sdk-manifest.json',
        tmpDir: '/fsx/tmp',
      },
      target: { os: 'macos', arch: 'arm64' },
      pinnedVersion: '3.47.1',
      releasesBaseUrl: 'https://example.test',
      fetchJson: () =>
        Promise.resolve({
          base_url: 'https://example.test',
          releases: [
            {
              hash: 'h',
              channel: 'stable',
              version: '3.47.1',
              dart_sdk_arch: 'arm64',
              archive: 'stable/macos/flutter.zip',
              sha256: 'sha',
            },
          ],
        }),
      download: (_url, _destination, onProgress) => {
        onProgress?.(10, 100);
        return Promise.resolve({ sha256: 'sha' });
      },
      extract: () => Promise.resolve(),
      pathExists: () => Promise.resolve(true),
      ensureDir: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      replaceDir: () => Promise.resolve(),
      readManifest: () => Promise.resolve(null),
      writeManifest: () => Promise.resolve(),
      now: () => '2026-08-23T00:00:00.000Z',
      report: (message) => {
        reported.push(message);
      },
      onProgress: (received, total) => {
        progressed.push([received, total]);
      },
    };

    await runInstallCommand(overrides, {
      projectDir: '/app',
      hasManifest: () => Promise.resolve(false),
      sync: () => Promise.reject(new Error('must not sync without a project')),
      out: () => undefined,
    });

    expect(reported).toEqual([
      'Resolving Flutter 3.47.1 for macos-arm64…',
      'Downloading https://example.test/stable/macos/flutter.zip…',
      'Extracting…',
      'Flutter 3.47.1 installed at /fsx/flutter',
    ]);
    expect(progressed).toEqual([[10, 100]]);
  });
});

describe('runInstallCommand — the plugin phase', () => {
  const sdkOnly: Partial<InstallDeps> = {
    paths: {
      home: '/fsx',
      sdkDir: '/fsx/flutter',
      manifestPath: '/fsx/sdk-manifest.json',
      tmpDir: '/fsx/tmp',
    },
    target: { os: 'macos', arch: 'arm64' },
    pinnedVersion: '3.47.1',
    fetchJson: () =>
      Promise.resolve({
        base_url: 'https://example.test',
        releases: [
          {
            hash: 'h',
            channel: 'stable',
            version: '3.47.1',
            dart_sdk_arch: 'arm64',
            archive: 'stable/macos/flutter.zip',
            sha256: 'sha',
          },
        ],
      }),
    download: () => Promise.resolve({ sha256: 'sha' }),
    extract: () => Promise.resolve(),
    pathExists: () => Promise.resolve(true),
    ensureDir: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    replaceDir: () => Promise.resolve(),
    readManifest: () => Promise.resolve(null),
    writeManifest: () => Promise.resolve(),
    now: () => '2026-08-23T00:00:00.000Z',
    report: () => undefined,
  };

  test('installs the plugins the project declares after the SDK', async () => {
    const lines: string[] = [];
    const synced: string[] = [];

    await runInstallCommand(sdkOnly, {
      projectDir: '/app',
      hasManifest: () => Promise.resolve(true),
      sync: (directory) => {
        synced.push(directory);
        return Promise.resolve();
      },
      out: (line) => {
        lines.push(line);
      },
    });

    expect(synced).toEqual(['/app']);
    expect(lines).toEqual([]);
  });

  test('installs the SDK alone outside a project', async () => {
    const lines: string[] = [];

    await runInstallCommand(sdkOnly, {
      projectDir: '/elsewhere',
      hasManifest: () => Promise.resolve(false),
      sync: () => Promise.reject(new Error('must not sync without a project')),
      out: (line) => {
        lines.push(line);
      },
    });

    expect(lines).toEqual([
      'No package.json in /elsewhere — installed the SDK only.',
    ]);
  });
});

describe('defaultPluginPhase', () => {
  test('targets the working directory and detects a project there', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-phase-'));
    const phase = defaultPluginPhase();

    expect(phase.projectDir).toBe(process.cwd());
    expect(await phase.hasManifest(dir)).toBe(false);

    await Bun.write(join(dir, 'package.json'), '{"name":"demo"}');

    expect(await phase.hasManifest(dir)).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  test('syncs against the real filesystem, reporting a directory with no project', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-phase-'));

    expect(defaultPluginPhase().sync(dir)).rejects.toThrow(
      `${dir}/package.json does not exist — run \`fsx init\` first.`,
    );

    await rm(dir, { recursive: true, force: true });
  });
});
