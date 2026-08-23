import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

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
  '01-camera-screen',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'camera_screen.dart';

void main() {
  runApp(const MaterialApp(home: CameraScreen()));
}
`;

describe('golden Dart builds as a real Flutter app', () => {
  test('fixture #1 expected.dart compiles into a web build', async () => {
    const appDir = await createFlutterWebApp();
    await addPubDependency(appDir, 'camera');

    const goldenDart = await Bun.file(join(fixtureDir, 'expected.dart')).text();
    await Bun.write(join(appDir, 'lib', 'camera_screen.dart'), goldenDart);
    await Bun.write(join(appDir, 'lib', 'main.dart'), MAIN_DART);

    const build = await buildWeb(appDir);

    expect(build.exitCode).toBe(0);
    expect(
      await Bun.file(join(appDir, 'build', 'web', 'main.dart.js')).exists(),
    ).toBe(true);
  }, 900000);
});
