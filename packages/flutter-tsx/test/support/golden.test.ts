import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import { ensurePackageResolved } from '@test/support/golden';

const emptyDir = await mkdtemp(join(tmpdir(), 'fsx-golden-'));

afterAll(async () => {
  await rm(emptyDir, { recursive: true, force: true });
});

describe('ensurePackageResolved', () => {
  test('fails loudly when flutter pub get cannot resolve the package', () => {
    expect(ensurePackageResolved(emptyDir)).rejects.toThrow(
      new Error(`flutter pub get failed (exit 1) in ${emptyDir}`),
    );
  });
});
