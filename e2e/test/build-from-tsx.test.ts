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
  '01-camera-screen',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'camera_screen.dart';

void main() {
  runApp(const MaterialApp(home: CameraScreen()));
}
`;

// The trust milestone: the flagship camera snippet — TSX in, running web
// build out.
describe('TSX builds as a real Flutter app', () => {
  test('fixture #1 input.tsx transpiles and compiles into a web build', async () => {
    const source = await Bun.file(join(fixtureDir, 'input.tsx')).text();
    const generated = await transpileComponent({
      source,
      filePath: join(fixtureDir, 'input.tsx'),
    });

    const appDir = await createFlutterWebApp();
    await addPubDependency(appDir, 'camera');
    await Bun.write(join(appDir, 'lib', 'camera_screen.dart'), generated);
    await Bun.write(join(appDir, 'lib', 'main.dart'), MAIN_DART);

    const build = await buildWeb(appDir);

    expect(build.exitCode).toBe(0);
  }, 900000);
});
