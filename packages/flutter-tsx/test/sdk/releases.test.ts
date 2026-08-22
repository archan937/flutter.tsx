import { describe, expect, test } from 'bun:test';

import {
  archiveUrl,
  parseReleasesIndex,
  releasesIndexUrl,
  selectRelease,
} from '@src/sdk/releases';

const BASE_URL =
  'https://storage.googleapis.com/flutter_infra_release/releases';

const rawIndex = {
  base_url: BASE_URL,
  current_release: { stable: 'hash-a' },
  releases: [
    {
      hash: 'hash-a',
      channel: 'stable',
      version: '3.47.1',
      dart_sdk_arch: 'arm64',
      archive: 'stable/macos/flutter_macos_arm64_3.47.1-stable.zip',
      sha256: 'sha-arm64',
    },
    {
      hash: 'hash-a',
      channel: 'stable',
      version: '3.47.1',
      dart_sdk_arch: 'x64',
      archive: 'stable/macos/flutter_macos_3.47.1-stable.zip',
      sha256: 'sha-x64',
    },
    {
      hash: 'hash-b',
      channel: 'beta',
      version: '3.48.0-0.1.pre',
      dart_sdk_arch: 'arm64',
      archive: 'beta/macos/flutter_macos_arm64_3.48.0-0.1.pre-beta.zip',
      sha256: 'sha-beta',
    },
    {
      hash: 'hash-c',
      channel: 'stable',
      version: '1.22.6',
      archive: 'stable/macos/flutter_macos_1.22.6-stable.zip',
      sha256: 'sha-legacy',
    },
  ],
};

describe('releasesIndexUrl', () => {
  test('points at the official index for the given OS', () => {
    expect(releasesIndexUrl('macos')).toBe(`${BASE_URL}/releases_macos.json`);
    expect(releasesIndexUrl('linux')).toBe(`${BASE_URL}/releases_linux.json`);
    expect(releasesIndexUrl('windows')).toBe(
      `${BASE_URL}/releases_windows.json`,
    );
  });
});

describe('parseReleasesIndex', () => {
  test('parses a valid index and defaults missing dart_sdk_arch to x64', () => {
    const index = parseReleasesIndex(rawIndex);

    expect(index.baseUrl).toBe(BASE_URL);
    expect(index.releases).toHaveLength(4);
    expect(index.releases[3]?.dartSdkArch).toBe('x64');
  });

  test('rejects non-object payloads', () => {
    expect(() => parseReleasesIndex(null)).toThrow(
      'releases index: expected an object',
    );
    expect(() => parseReleasesIndex('nope')).toThrow(
      'releases index: expected an object',
    );
  });

  test('rejects a missing base_url', () => {
    expect(() => parseReleasesIndex({ releases: [] })).toThrow(
      'releases index: base_url is missing or not a string',
    );
  });

  test('rejects a missing releases array', () => {
    expect(() => parseReleasesIndex({ base_url: BASE_URL })).toThrow(
      'releases index: releases is missing or not an array',
    );
  });

  test('rejects an entry with missing fields', () => {
    const broken = {
      base_url: BASE_URL,
      releases: [{ channel: 'stable', version: '3.47.1' }],
    };

    expect(() => parseReleasesIndex(broken)).toThrow(
      'releases index: release #0 is malformed',
    );
  });

  test('rejects an entry that is not an object', () => {
    const broken = { base_url: BASE_URL, releases: ['not-a-release'] };

    expect(() => parseReleasesIndex(broken)).toThrow(
      'releases index: release #0 is malformed',
    );
  });
});

describe('selectRelease', () => {
  const index = parseReleasesIndex(rawIndex);

  test('finds the stable release matching version and arch', () => {
    const release = selectRelease(index, { version: '3.47.1', arch: 'arm64' });

    expect(release.archive).toBe(
      'stable/macos/flutter_macos_arm64_3.47.1-stable.zip',
    );
    expect(release.sha256).toBe('sha-arm64');
  });

  test('distinguishes architectures of the same version', () => {
    const release = selectRelease(index, { version: '3.47.1', arch: 'x64' });

    expect(release.sha256).toBe('sha-x64');
  });

  test('throws when the version is not in the index', () => {
    expect(() =>
      selectRelease(index, { version: '9.9.9', arch: 'arm64' }),
    ).toThrow('Flutter 9.9.9 (arm64) not found in the stable releases index');
  });
});

describe('archiveUrl', () => {
  test('joins base_url and the archive path', () => {
    const index = parseReleasesIndex(rawIndex);
    const release = selectRelease(index, { version: '3.47.1', arch: 'arm64' });

    expect(archiveUrl(index, release)).toBe(
      `${BASE_URL}/stable/macos/flutter_macos_arm64_3.47.1-stable.zip`,
    );
  });
});
