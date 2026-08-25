import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { transpileComponent } from 'flutter-tsx/compiler';

import { buildWeb, createFlutterWebApp } from './support/flutter-app';

const fixtureDir = join(
  import.meta.dir,
  '..',
  '..',
  'packages',
  'flutter-tsx',
  'test',
  'fixtures',
  '03-styled-container',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'styled_card.dart';

void main() {
  runApp(const MaterialApp(home: StyledCard()));
}
`;

// The value-props sign-off: colors, insets, and TextStyle objects — TSX in,
// web build out.
describe('styled TSX builds as a real Flutter app', () => {
  test('fixture #3 input.tsx transpiles and compiles into a web build', async () => {
    const source = await Bun.file(join(fixtureDir, 'input.tsx')).text();
    const generated = await transpileComponent({
      source,
      filePath: join(fixtureDir, 'input.tsx'),
    });
    const expected = await Bun.file(join(fixtureDir, 'expected.dart')).text();
    expect(generated).toBe(expected);

    const appDir = await createFlutterWebApp();
    await Bun.write(join(appDir, 'lib', 'styled_card.dart'), generated);
    await Bun.write(join(appDir, 'lib', 'main.dart'), MAIN_DART);

    const build = await buildWeb(appDir);

    expect(build.exitCode).toBe(0);
    expect(
      await Bun.file(join(appDir, 'build', 'web', 'main.dart.js')).exists(),
    ).toBe(true);
  }, 900000);
});
