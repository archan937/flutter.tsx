import { describe, expect, test } from 'bun:test';

import { FLUTTER_TSX_VERSION } from '@src/index';

describe('public API surface', () => {
  test('exposes the package version, in sync with package.json', async () => {
    const manifestPath = new URL('../package.json', import.meta.url);
    const manifest = (await Bun.file(manifestPath).json()) as {
      version: string;
    };

    expect(FLUTTER_TSX_VERSION).toBe(manifest.version);
  });
});
