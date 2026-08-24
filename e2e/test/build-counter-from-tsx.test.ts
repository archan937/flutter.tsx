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
  '05-counter',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'counter.dart';

void main() {
  runApp(const MaterialApp(home: Counter()));
}
`;

// The stateful sign-off: useState + a setState handler, TSX in, web build out.
describe('stateful TSX builds as a real Flutter app', () => {
  test('fixture #5 input.tsx transpiles and compiles into a web build', async () => {
    const source = await Bun.file(join(fixtureDir, 'input.tsx')).text();
    const generated = await transpileComponent({
      source,
      filePath: join(fixtureDir, 'input.tsx'),
    });
    const expected = await Bun.file(join(fixtureDir, 'expected.dart')).text();
    expect(generated).toBe(expected);

    const appDir = await createFlutterWebApp();
    await Bun.write(join(appDir, 'lib', 'counter.dart'), generated);
    await Bun.write(join(appDir, 'lib', 'main.dart'), MAIN_DART);

    const build = await buildWeb(appDir);

    expect(build.exitCode).toBe(0);
    expect(
      await Bun.file(join(appDir, 'build', 'web', 'main.dart.js')).exists(),
    ).toBe(true);
  }, 900000);
});
