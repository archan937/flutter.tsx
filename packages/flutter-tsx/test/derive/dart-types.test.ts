import { describe, expect, test } from 'bun:test';

import { dartTypeOf } from '@src/derive/dart-types';

describe('dartTypeOf', () => {
  test('scalars map to their Dart spelling', () => {
    expect(dartTypeOf({ kind: 'scalar', name: 'String' })).toBe('String');
    expect(dartTypeOf({ kind: 'scalar', name: 'bool' })).toBe('bool');
    expect(dartTypeOf({ kind: 'scalar', name: 'int' })).toBe('int');
    expect(dartTypeOf({ kind: 'scalar', name: 'double' })).toBe('double');
    expect(dartTypeOf({ kind: 'scalar', name: 'num' })).toBe('num');
  });

  test('named entities, enums and widgets keep their name', () => {
    expect(dartTypeOf({ kind: 'named', name: 'PackageInfo' })).toBe(
      'PackageInfo',
    );
    expect(dartTypeOf({ kind: 'enum', name: 'LaunchMode' })).toBe('LaunchMode');
    expect(dartTypeOf({ kind: 'widget' })).toBe('Widget');
  });

  test('containers nest their item types', () => {
    expect(
      dartTypeOf({
        kind: 'list',
        item: { kind: 'named', name: 'CameraDescription' },
      }),
    ).toBe('List<CameraDescription>');
    expect(
      dartTypeOf({ kind: 'set', item: { kind: 'scalar', name: 'int' } }),
    ).toBe('Set<int>');
    expect(
      dartTypeOf({ kind: 'future', item: { kind: 'scalar', name: 'bool' } }),
    ).toBe('Future<bool>');
    expect(
      dartTypeOf({
        kind: 'map',
        key: { kind: 'scalar', name: 'String' },
        value: { kind: 'scalar', name: 'String' },
      }),
    ).toBe('Map<String, String>');
    expect(
      dartTypeOf({
        kind: 'nullable',
        inner: { kind: 'scalar', name: 'String' },
      }),
    ).toBe('String?');
  });

  // Every ScalarName has a Dart spelling, so an unmapped scalar is
  // unreachable by typing — the container cases carry the null propagation.
  test('a type with no Dart spelling is null, never a guess', () => {
    expect(dartTypeOf({ kind: 'unknown' })).toBeNull();
    expect(dartTypeOf({ kind: 'void' })).toBeNull();
    expect(
      dartTypeOf({ kind: 'nullable', inner: { kind: 'unknown' } }),
    ).toBeNull();
    expect(dartTypeOf({ kind: 'list', item: { kind: 'unknown' } })).toBeNull();
    expect(dartTypeOf({ kind: 'set', item: { kind: 'unknown' } })).toBeNull();
    expect(
      dartTypeOf({ kind: 'future', item: { kind: 'unknown' } }),
    ).toBeNull();
    expect(
      dartTypeOf({
        kind: 'map',
        key: { kind: 'unknown' },
        value: { kind: 'scalar', name: 'String' },
      }),
    ).toBeNull();
    expect(
      dartTypeOf({
        kind: 'map',
        key: { kind: 'scalar', name: 'String' },
        value: { kind: 'unknown' },
      }),
    ).toBeNull();
  });
});
