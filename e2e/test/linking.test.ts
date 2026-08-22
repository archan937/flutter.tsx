import { describe, expect, test } from 'bun:test';
import { CREATE_FLUTTER_TSX_VERSION } from 'create-flutter-tsx';
import { FLUTTER_TSX_VERSION } from 'flutter-tsx';

describe('cross-package linking', () => {
  test('flutter-tsx resolves as a dependency', () => {
    expect(FLUTTER_TSX_VERSION).toBe('1.0.0-alpha.0');
  });

  test('create-flutter-tsx resolves as a dependency', () => {
    expect(CREATE_FLUTTER_TSX_VERSION).toBe('1.0.0-alpha.0');
  });
});
