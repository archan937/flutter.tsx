import { describe, expect, test } from 'bun:test';

import { FLUTTER_VERSION } from '@src/sdk/version';

describe('FLUTTER_VERSION', () => {
  test('is a plain semver-style version', () => {
    expect(FLUTTER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
