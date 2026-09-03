import { describe, expect, test } from 'bun:test';

import { defineDelegate } from '@src/runtime/delegate';

/**
 * `defineDelegate` is a compile target, like every other primitive here.
 *
 * The transpiler reads the call from the AST and writes a Dart subclass, so
 * running one is always a mistake — and one that says so, naming the class
 * it was asked to write.
 */
describe('defineDelegate', () => {
  test('says it is compile-time, and what it was asked to write', () => {
    expect(() =>
      defineDelegate('FlowDelegate', {
        paintChildren: () => undefined,
        shouldRepaint: () => false,
      }),
    ).toThrow("defineDelegate('FlowDelegate') is compile-time: 2 members");
  });
});
