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
  '18-connectivity-stream',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'connection_banner.dart';

void main() {
  runApp(const MaterialApp(home: ConnectionBanner()));
}
`;

const WIDGET_TEST = `import 'dart:async';

import 'package:connectivity_plus_platform_interface/connectivity_plus_platform_interface.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/connection_banner.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

class _FakeConnectivity extends ConnectivityPlatform
    with MockPlatformInterfaceMixin {
  final StreamController<List<ConnectivityResult>> controller =
      StreamController<List<ConnectivityResult>>();

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged =>
      controller.stream;

  @override
  Future<List<ConnectivityResult>> checkConnectivity() async {
    return <ConnectivityResult>[ConnectivityResult.wifi];
  }
}

void main() {
  testWidgets('rebuilds on every stream event', (tester) async {
    final fake = _FakeConnectivity();
    ConnectivityPlatform.instance = fake;
    addTearDown(() => fake.controller.close());

    await tester.pumpWidget(const MaterialApp(home: ConnectionBanner()));

    // Nothing has been emitted yet: the loading fallback is what renders.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    fake.controller.add(<ConnectivityResult>[ConnectivityResult.wifi]);
    await tester.pumpAndSettle();
    expect(find.text('Connections: 1'), findsOneWidget);

    // A second event rebuilds with the new value — a stream, not a future.
    fake.controller.add(<ConnectivityResult>[
      ConnectivityResult.wifi,
      ConnectivityResult.mobile,
    ]);
    await tester.pumpAndSettle();
    expect(find.text('Connections: 2'), findsOneWidget);
  });
}
`;

// The useStream sign-off: a plugin stream property becomes a StreamBuilder —
// TSX in, web build out, and the widget test proves the loading fallback
// renders first and that EVERY event rebuilds (what separates a stream from
// a future).
describe('connectivity-stream TSX builds and behaves as a real Flutter app', () => {
  test('fixture #18 builds for web and rebuilds per event', async () => {
    const source = await Bun.file(join(fixtureDir, 'input.tsx')).text();
    const generated = await transpileComponent({
      source,
      filePath: join(fixtureDir, 'input.tsx'),
    });
    const expected = await Bun.file(join(fixtureDir, 'expected.dart')).text();
    expect(generated).toBe(expected);

    const appDir = await createFlutterWebApp();
    await addPubDependency(appDir, 'connectivity_plus');
    await addPubDependency(appDir, 'connectivity_plus_platform_interface');
    await addPubDependency(appDir, 'plugin_platform_interface');
    await Bun.write(
      join(appDir, 'lib', 'connection_banner.dart'),
      generated,
    );
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
