import { describe, expect, test } from 'bun:test';

import { dartdocToJsdoc } from '@src/generate/doc';

describe('dartdocToJsdoc', () => {
  test('converts a multi-paragraph dartdoc block', () => {
    const dartdoc = [
      '/// Centers its child.',
      '///',
      '/// See also [Align] for arbitrary positioning.',
    ].join('\n');

    expect(dartdocToJsdoc(dartdoc, '')).toBe(
      [
        '/**',
        ' * Centers its child.',
        ' *',
        ' * See also [Align] for arbitrary positioning.',
        ' */',
      ].join('\n'),
    );
  });

  test('indents the block for nested members', () => {
    expect(dartdocToJsdoc('/// The title.', '  ')).toBe(
      ['  /**', '   * The title.', '   */'].join('\n'),
    );
  });

  test('drops flutter doc macros but keeps prose and code', () => {
    const dartdoc = [
      '/// A cubic curve.',
      '///',
      '/// {@tool snippet}',
      '/// ```dart',
      '/// Icon(Icons.widgets)',
      '/// ```',
      '/// {@end-tool}',
      '/// {@animation 464 192 https://example.test/curve.mp4}',
      '/// {@template flutter.widgets.something}',
      '/// Templated prose stays.',
      '/// {@endtemplate}',
      '/// {@macro flutter.widgets.something}',
    ].join('\n');

    expect(dartdocToJsdoc(dartdoc, '')).toBe(
      [
        '/**',
        ' * A cubic curve.',
        ' *',
        ' * ```dart',
        ' * Icon(Icons.widgets)',
        ' * ```',
        ' * Templated prose stays.',
        ' */',
      ].join('\n'),
    );
  });

  test('escapes comment terminators', () => {
    expect(dartdocToJsdoc('/// Weird */ content.', '')).toBe(
      ['/**', ' * Weird *\\/ content.', ' */'].join('\n'),
    );
  });

  test('returns an empty string for empty documentation', () => {
    expect(dartdocToJsdoc('', '')).toBe('');
  });
});
