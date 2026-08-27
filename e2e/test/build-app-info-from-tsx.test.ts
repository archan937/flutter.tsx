import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { transpileComponent } from 'flutter-tsx/compiler';

import {
  addPubDependency,
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
  '14-app-info',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'app_info.dart';

void main() {
  runApp(const MaterialApp(home: AppInfo()));
}
`;

const WIDGET_TEST = `import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/app_info.dart';
import 'package:package_info_plus/package_info_plus.dart';

void main() {
  testWidgets('renders properties read off the resolved handle', (
    tester,
  ) async {
    PackageInfo.setMockInitialValues(
      appName: 'Flutter.tsx Demo',
      packageName: 'dev.fluttertsx.demo',
      version: '4.2.0',
      buildNumber: '7',
      buildSignature: 'sig',
    );

    await tester.pumpWidget(const MaterialApp(home: AppInfo()));

    // Before the singleton resolves, the zero-value fallbacks render.
    expect(find.text('Flutter.tsx Demo'), findsNothing);
    expect(find.text('v'), findsOneWidget);

    await tester.pumpAndSettle();
    expect(find.text('Flutter.tsx Demo'), findsOneWidget);
    expect(find.text('v4.2.0'), findsOneWidget);
  });
}
`;

// The property-read sign-off: a static-factory handle whose fields are read
// straight in JSX — TSX in, web build out, and the widget test proves both
// the pre-resolution fallback and the resolved values render.
describe('app-info TSX builds and behaves as a real Flutter app', () => {
  test('fixture #14 builds for web and reads properties at runtime', async () => {
    const source = await Bun.file(join(fixtureDir, 'input.tsx')).text();
    const generated = await transpileComponent({
      source,
      filePath: join(fixtureDir, 'input.tsx'),
    });
    const expected = await Bun.file(join(fixtureDir, 'expected.dart')).text();
    expect(generated).toBe(expected);

    const appDir = await createFlutterWebApp();
    await addPubDependency(appDir, 'package_info_plus');
    await Bun.write(join(appDir, 'lib', 'app_info.dart'), generated);
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
