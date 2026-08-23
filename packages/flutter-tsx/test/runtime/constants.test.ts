import { describe, expect, test } from 'bun:test';

import {
  type ConstantReference,
  declareConstants,
} from '@src/runtime/constants';

describe('declareConstants', () => {
  test('members resolve to references into their namespace', () => {
    const palette = declareConstants<{ readonly red: ConstantReference }>(
      'Colors',
    );

    expect(palette.red).toEqual({ namespace: 'Colors', name: 'red' });
  });
});
