import { describe, expect, test } from 'bun:test';

import { transpileComponent } from '@src/compiler/transpile';

describe('transpileComponent', () => {
  test('is honestly not implemented yet', () => {
    expect(() =>
      transpileComponent({
        source: 'export const X = () => null;',
        filePath: 'x.tsx',
      }),
    ).toThrow(
      new Error(
        'flutter-tsx compiler: not implemented yet — the golden fixtures ' +
          'stay red until roadmap steps 11–21 earn them.',
      ),
    );
  });
});
