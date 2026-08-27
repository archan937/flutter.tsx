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
  '13-open-link',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'open_link.dart';

void main() {
  runApp(const MaterialApp(home: OpenLink()));
}
`;

const WIDGET_TEST = `import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/open_link.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

class _RecordingLauncher extends UrlLauncherPlatform
    with MockPlatformInterfaceMixin {
  final List<String> launchedUrls = <String>[];
  final List<PreferredLaunchMode> launchedModes = <PreferredLaunchMode>[];

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    launchedUrls.add(url);
    launchedModes.add(options.mode);
    return true;
  }
}

void main() {
  testWidgets('launches the url with the requested mode', (tester) async {
    final launcher = _RecordingLauncher();
    UrlLauncherPlatform.instance = launcher;

    await tester.pumpWidget(const MaterialApp(home: OpenLink()));
    await tester.pumpAndSettle();
    expect(find.text('Opened!'), findsNothing);

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Opened!'), findsOneWidget);
    expect(launcher.launchedUrls, <String>['https://flutter.dev']);
    expect(launcher.launchedModes, <PreferredLaunchMode>[
      PreferredLaunchMode.externalApplication,
    ]);
  });
}
`;

// The navigation-breed sign-off: a top-level plugin function — TSX in, web
// build out, and the runtime widget test proves the Uri and the enum named
// argument both reach the platform.
describe('open-link TSX builds and behaves as a real Flutter app', () => {
  test('fixture #13 builds for web and launches at runtime', async () => {
    const source = await Bun.file(join(fixtureDir, 'input.tsx')).text();
    const generated = await transpileComponent({
      source,
      filePath: join(fixtureDir, 'input.tsx'),
    });
    const expected = await Bun.file(join(fixtureDir, 'expected.dart')).text();
    expect(generated).toBe(expected);

    const appDir = await createFlutterWebApp();
    await addPubDependency(appDir, 'url_launcher');
    await addPubDependency(appDir, 'url_launcher_platform_interface');
    await addPubDependency(appDir, 'plugin_platform_interface');
    await Bun.write(join(appDir, 'lib', 'open_link.dart'), generated);
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
