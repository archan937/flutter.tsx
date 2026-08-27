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
  '17-async-token',
);

const MAIN_DART = `import 'package:flutter/material.dart';

import 'token_check.dart';

void main() {
  runApp(const MaterialApp(home: TokenCheck()));
}
`;

const WIDGET_TEST = `import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/token_check.dart';

void main() {
  testWidgets('shows the loading state, then the resolved value', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues(<String, String>{
      'token': 'abc',
    });

    await tester.pumpWidget(const MaterialApp(home: TokenCheck()));

    // The future has not completed on the first frame: the loading fallback
    // is what a user sees.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Signed in'), findsNothing);

    await tester.pumpAndSettle();
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Signed in'), findsOneWidget);
  });

  testWidgets('renders the empty case once resolved', (tester) async {
    FlutterSecureStorage.setMockInitialValues(<String, String>{});

    await tester.pumpWidget(const MaterialApp(home: TokenCheck()));
    await tester.pumpAndSettle();

    expect(find.text('Signed out'), findsOneWidget);
  });
}
`;

// The useAsync sign-off: an async component becomes a StatefulWidget whose
// build is a FutureBuilder — TSX in, web build out, and the widget tests
// prove the loading fallback renders first and both resolved branches follow.
describe('async-token TSX builds and behaves as a real Flutter app', () => {
  test('fixture #17 builds for web and resolves at runtime', async () => {
    const source = await Bun.file(join(fixtureDir, 'input.tsx')).text();
    const generated = await transpileComponent({
      source,
      filePath: join(fixtureDir, 'input.tsx'),
    });
    const expected = await Bun.file(join(fixtureDir, 'expected.dart')).text();
    expect(generated).toBe(expected);

    const appDir = await createFlutterWebApp();
    await addPubDependency(appDir, 'flutter_secure_storage');
    await Bun.write(join(appDir, 'lib', 'token_check.dart'), generated);
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
