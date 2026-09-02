import { describe, expect, test } from 'bun:test';

import type { TypeNode } from '@src/api/model';
import { tsTypeOf } from '@src/generate/ts-types';

const scalar = (
  name: 'String' | 'bool' | 'int' | 'double' | 'num',
): TypeNode => ({
  kind: 'scalar',
  name,
});

describe('tsTypeOf', () => {
  test('scalars', () => {
    expect(tsTypeOf(scalar('String'))).toBe('string');
    expect(tsTypeOf(scalar('bool'))).toBe('boolean');
    expect(tsTypeOf(scalar('int'))).toBe('number');
    expect(tsTypeOf(scalar('double'))).toBe('number');
    expect(tsTypeOf(scalar('num'))).toBe('number');
  });

  test('widgets and unknowns', () => {
    expect(tsTypeOf({ kind: 'widget' })).toBe('FlutterElement');
    expect(tsTypeOf({ kind: 'unknown' })).toBe('unknown');
    expect(tsTypeOf({ kind: 'void' })).toBe('void');
  });

  test('enums and named types reference their generated names', () => {
    expect(tsTypeOf({ kind: 'enum', name: 'MainAxisAlignment' })).toBe(
      'MainAxisAlignment',
    );
    expect(tsTypeOf({ kind: 'named', name: 'Color' })).toBe('Color');
  });

  test('nullable adds null to the union', () => {
    expect(tsTypeOf({ kind: 'nullable', inner: { kind: 'widget' } })).toBe(
      'FlutterElement | null',
    );
  });

  test('nullable parenthesizes function types', () => {
    expect(
      tsTypeOf({
        kind: 'nullable',
        inner: { kind: 'function', returnType: { kind: 'void' }, params: [] },
      }),
    ).toBe('(() => void) | null');
  });

  test('collections', () => {
    expect(tsTypeOf({ kind: 'list', item: { kind: 'widget' } })).toBe(
      'FlutterElement[]',
    );
    expect(
      tsTypeOf({
        kind: 'list',
        item: { kind: 'nullable', inner: scalar('int') },
      }),
    ).toBe('(number | null)[]');
    expect(tsTypeOf({ kind: 'set', item: scalar('String') })).toBe('string[]');
    expect(
      tsTypeOf({ kind: 'map', key: scalar('String'), value: scalar('int') }),
    ).toBe('Record<string, number>');
    expect(
      tsTypeOf({
        kind: 'map',
        key: { kind: 'named', name: 'ShortcutActivator' },
        value: { kind: 'named', name: 'Intent' },
      }),
    ).toBe('Map<ShortcutActivator, Intent>');
    // A map keyed by anything else that a record can hold is a record of it.
    expect(
      tsTypeOf({ kind: 'map', key: scalar('int'), value: scalar('String') }),
    ).toBe('Record<number, string>');
  });

  test('futures become promises', () => {
    expect(tsTypeOf({ kind: 'future', item: scalar('int') })).toBe(
      'Promise<number>',
    );
  });

  test('functions become arrow types with named parameters preserved', () => {
    expect(
      tsTypeOf({
        kind: 'function',
        returnType: { kind: 'void' },
        params: [],
      }),
    ).toBe('() => void');
    expect(
      tsTypeOf({
        kind: 'function',
        returnType: { kind: 'void' },
        params: [
          {
            name: 'value',
            type: scalar('String'),
            named: false,
            required: true,
          },
        ],
      }),
    ).toBe('(value: string) => void');
    expect(
      tsTypeOf({
        kind: 'function',
        returnType: { kind: 'nullable', inner: scalar('bool') },
        params: [
          { name: '', type: scalar('int'), named: false, required: true },
          {
            name: 'label',
            type: scalar('String'),
            named: true,
            required: false,
          },
        ],
      }),
    ).toBe('(arg0: number, label?: string) => boolean | null');
  });
});
