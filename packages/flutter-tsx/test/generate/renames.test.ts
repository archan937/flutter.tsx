import { describe, expect, test } from 'bun:test';

import { jsxPropName } from '@src/generate/renames';

describe('jsxPropName', () => {
  test('renames tap-like handlers to onClick', () => {
    expect(jsxPropName('onPressed', new Set())).toBe('onClick');
    expect(jsxPropName('onTap', new Set())).toBe('onClick');
  });

  test('keeps the original name when the rename would collide', () => {
    expect(jsxPropName('onTap', new Set(['onClick']))).toBe('onTap');
  });

  test('passes ordinary names through unchanged', () => {
    expect(jsxPropName('mainAxisAlignment', new Set())).toBe(
      'mainAxisAlignment',
    );
  });
});
