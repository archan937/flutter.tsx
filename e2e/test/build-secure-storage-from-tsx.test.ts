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
  '12-secure-storage',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'vault.dart';

void main() {
  runApp(const MaterialApp(home: Vault()));
}
`;

const WIDGET_TEST = `import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/vault.dart';

void main() {
  testWidgets('writes through the const service and really persists', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues(<String, String>{});

    await tester.pumpWidget(const MaterialApp(home: Vault()));
    await tester.pumpAndSettle();
    expect(find.text('Saved!'), findsNothing);

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(find.text('Saved!'), findsOneWidget);

    const storage = FlutterSecureStorage();
    expect(await storage.read(key: 'token'), 'secret');
  });
}
`;

// The service-breed sign-off: a derived const-field hook — TSX in, web build
// out, and the runtime widget test proves the named-args write persists.
describe('secure storage TSX builds and behaves as a real Flutter app', () => {
  test('fixture #12 builds for web and persists at runtime', async () => {
    const source = await Bun.file(join(fixtureDir, 'input.tsx')).text();
    const generated = await transpileComponent({
      source,
      filePath: join(fixtureDir, 'input.tsx'),
    });
    const expected = await Bun.file(join(fixtureDir, 'expected.dart')).text();
    expect(generated).toBe(expected);

    const appDir = await createFlutterWebApp();
    await addPubDependency(appDir, 'flutter_secure_storage');
    await Bun.write(join(appDir, 'lib', 'vault.dart'), generated);
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
