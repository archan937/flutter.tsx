import { describe, expect, test } from 'bun:test';

import { generateAll } from '@src/generate/output';

describe('committed src/generated/ files', () => {
  test('are byte-identical to a fresh generation', async () => {
    const packageRoot = new URL('../..', import.meta.url);

    for (const file of await generateAll()) {
      const committed = await Bun.file(
        new URL(file.relativePath, packageRoot),
      ).text();
      expect(committed).toBe(file.content);
    }
  }, 120000);
});
