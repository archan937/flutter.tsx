import { describe, expect, test } from 'bun:test';

import { resolveReleaseTarget } from '@src/sdk/platform';

describe('resolveReleaseTarget', () => {
  test('maps macOS arm64', () => {
    expect(resolveReleaseTarget('darwin', 'arm64')).toEqual({
      os: 'macos',
      arch: 'arm64',
    });
  });

  test('maps macOS x64', () => {
    expect(resolveReleaseTarget('darwin', 'x64')).toEqual({
      os: 'macos',
      arch: 'x64',
    });
  });

  test('maps Linux x64', () => {
    expect(resolveReleaseTarget('linux', 'x64')).toEqual({
      os: 'linux',
      arch: 'x64',
    });
  });

  test('maps Windows x64', () => {
    expect(resolveReleaseTarget('win32', 'x64')).toEqual({
      os: 'windows',
      arch: 'x64',
    });
  });

  test('rejects platforms Flutter does not ship archives for', () => {
    const supportMatrix =
      'Flutter ships SDK archives for macOS (x64/arm64), Linux (x64), and ' +
      'Windows (x64).';
    expect(() => resolveReleaseTarget('linux', 'arm64')).toThrow(
      new Error(`Unsupported platform: linux-arm64. ${supportMatrix}`),
    );
    expect(() => resolveReleaseTarget('freebsd', 'x64')).toThrow(
      new Error(`Unsupported platform: freebsd-x64. ${supportMatrix}`),
    );
  });
});
