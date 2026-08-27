import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { transpileComponent } from 'flutter-tsx/compiler';

import {
  addPubDependency,
  buildWeb,
  createFlutterWebApp,
} from './support/flutter-app';

const fixtureDir = join(
  import.meta.dir,
  '..',
  '..',
  'packages',
  'flutter-tsx',
  'test',
  'fixtures',
  '15-front-camera',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'selfie.dart';

void main() {
  runApp(const MaterialApp(home: Selfie()));
}
`;

// The supplier-filter sign-off: useCamera({ lens }) selects the camera by
// lensDirection with a first-item fallback — TSX in, web build out. Actual
// capture stays behind the real-device gate; widget tests can't drive the
// camera platform channel.
describe('front-camera TSX builds as a real Flutter app', () => {
  test('fixture #15 input.tsx transpiles and compiles into a web build', async () => {
    const source = await Bun.file(join(fixtureDir, 'input.tsx')).text();
    const generated = await transpileComponent({
      source,
      filePath: join(fixtureDir, 'input.tsx'),
    });
    const expected = await Bun.file(join(fixtureDir, 'expected.dart')).text();
    expect(generated).toBe(expected);

    const appDir = await createFlutterWebApp();
    await addPubDependency(appDir, 'camera');
    await Bun.write(join(appDir, 'lib', 'selfie.dart'), generated);
    await Bun.write(join(appDir, 'lib', 'main.dart'), MAIN_DART);

    const build = await buildWeb(appDir);

    expect(build.exitCode).toBe(0);
    expect(
      await Bun.file(join(appDir, 'build', 'web', 'main.dart.js')).exists(),
    ).toBe(true);
  }, 900000);
});
