import { describe, expect, test } from 'bun:test';

import { extractDeclarations } from '@src/site/declarations';

describe('extractDeclarations', () => {
  test('says which source it could not read', () => {
    expect(() =>
      extractDeclarations(['/nonexistent/module-that-is-not-there.ts']),
    ).toThrow(
      'declaration source /nonexistent/module-that-is-not-there.ts could not be read.',
    );
  });
});
