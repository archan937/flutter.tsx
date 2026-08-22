import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  readManifest,
  resolveFsxPaths,
  writeManifest,
} from '@src/sdk/manifest';

const manifest = {
  flutterVersion: '3.47.1',
  archive: 'stable/macos/flutter_macos_arm64_3.47.1-stable.zip',
  sha256: 'abc123',
  installedAt: '2026-08-23T00:00:00.000Z',
};

describe('resolveFsxPaths', () => {
  test('defaults to ~/.fsx', () => {
    const paths = resolveFsxPaths({}, '/Users/someone');

    expect(paths.home).toBe('/Users/someone/.fsx');
    expect(paths.sdkDir).toBe('/Users/someone/.fsx/flutter');
    expect(paths.manifestPath).toBe('/Users/someone/.fsx/sdk-manifest.json');
    expect(paths.tmpDir).toBe('/Users/someone/.fsx/tmp');
  });

  test('honors the FSX_HOME override', () => {
    const paths = resolveFsxPaths({ FSX_HOME: '/opt/fsx' }, '/Users/someone');

    expect(paths.home).toBe('/opt/fsx');
    expect(paths.sdkDir).toBe('/opt/fsx/flutter');
  });
});

describe('writeManifest / readManifest', () => {
  test('round-trips a manifest, creating parent directories', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-manifest-'));
    const path = join(dir, 'nested', 'sdk-manifest.json');

    await writeManifest(path, manifest);

    expect(await readManifest(path)).toEqual(manifest);
  });

  test('returns null when the manifest does not exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-manifest-'));

    expect(await readManifest(join(dir, 'missing.json'))).toBeNull();
  });

  test('returns null for corrupted or foreign JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-manifest-'));
    const corrupt = join(dir, 'corrupt.json');
    const foreign = join(dir, 'foreign.json');
    const nonObject = join(dir, 'non-object.json');
    await Bun.write(corrupt, 'not json at all');
    await Bun.write(foreign, JSON.stringify({ some: 'other file' }));
    await Bun.write(nonObject, JSON.stringify('just a string'));

    expect(await readManifest(corrupt)).toBeNull();
    expect(await readManifest(foreign)).toBeNull();
    expect(await readManifest(nonObject)).toBeNull();
  });
});
