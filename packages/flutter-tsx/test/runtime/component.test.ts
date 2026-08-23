import { describe, expect, test } from 'bun:test';

import { declareWidget } from '@src/runtime/component';

describe('declareWidget', () => {
  test('produces a component that builds widget nodes', () => {
    const Center = declareWidget<{ widthFactor?: number }>('Center');

    expect(Center.widgetName).toBe('Center');
    expect(Center({ widthFactor: 2 })).toEqual({
      widgetName: 'Center',
      props: { widthFactor: 2 },
    });
  });
});
