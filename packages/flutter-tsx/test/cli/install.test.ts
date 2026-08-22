import { describe, expect, test } from 'bun:test';

import {
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

    await runInstallCommand(overrides);

    expect(reported.some((line) => line.includes('3.47.1'))).toBe(true);
    expect(progressed).toEqual([[10, 100]]);
  });
});
