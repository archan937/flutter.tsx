import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { transpileComponent } from 'flutter-tsx/compiler';

import {
  buildWeb,
  createFlutterWebApp,
  runFlutterTest,
} from './support/flutter-app';

const fixtureDir = join(
  import.meta.dir,
  '..',
  '..',
  'packages',
  'flutter-tsx',
  'test',
  'fixtures',
  '16-tap-target',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'tap_target.dart';

void main() {
  runApp(const MaterialApp(home: TapTarget()));
}
`;

const WIDGET_TEST = `import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/tap_target.dart';

void main() {
  testWidgets('the wrapped widget really receives taps', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: TapTarget()));
    expect(find.text('Taps: 0'), findsOneWidget);

    await tester.tap(find.text('Tap me'));
    await tester.pump();
    expect(find.text('Taps: 1'), findsOneWidget);

    await tester.longPress(find.text('Tap me'));
    await tester.pump();
    expect(find.text('Taps: 2'), findsOneWidget);
  });
}
`;

// The gesture-prop sign-off: onClick/onLongPress on a plain Container become
// a GestureDetector wrap — TSX in, web build out, and the widget test proves
// both a tap and a long press reach the handler.
describe('tap-target TSX builds and behaves as a real Flutter app', () => {
  test('fixture #16 builds for web and handles gestures at runtime', async () => {
    const source = await Bun.file(join(fixtureDir, 'input.tsx')).text();
    const generated = await transpileComponent({
      source,
      filePath: join(fixtureDir, 'input.tsx'),
    });
    const expected = await Bun.file(join(fixtureDir, 'expected.dart')).text();
    expect(generated).toBe(expected);

    const appDir = await createFlutterWebApp();
    await Bun.write(join(appDir, 'lib', 'tap_target.dart'), generated);
    await Bun.write(join(appDir, 'lib', 'main.dart'), MAIN_DART);
    await Bun.write(join(appDir, 'test', 'widget_test.dart'), WIDGET_TEST);

    const behavior = await runFlutterTest(appDir);
    expect(behavior.exitCode).toBe(0);

    const build = await buildWeb(appDir);
    expect(build.exitCode).toBe(0);
    expect(
      await Bun.file(join(appDir, 'build', 'web', 'main.dart.js')).exists(),
    ).toBe(true);
  }, 900000);
});
