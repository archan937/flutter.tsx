import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { transpileComponent } from 'flutter-tsx/compiler';

import { createFlutterWebApp, runFlutterTest } from './support/flutter-app';

const fixturesDir = join(
  import.meta.dir,
  '..',
  '..',
  'packages',
  'flutter-tsx',
  'test',
  'fixtures',
);

const transpileFixture = async (id: string): Promise<string> => {
  const inputPath = join(fixturesDir, id, 'input.tsx');
  const source = await Bun.file(inputPath).text();
  return transpileComponent({ source, filePath: inputPath });
};

const behaviorApp = async (
  id: string,
  dartFile: string,
  widgetTest: string,
): Promise<string> => {
  const appDir = await createFlutterWebApp();
  await Bun.write(join(appDir, 'lib', dartFile), await transpileFixture(id));
  await Bun.write(join(appDir, 'test', 'widget_test.dart'), widgetTest);
  return appDir;
};

// The top rung of the sign-off ladder: the transpiled Dart EXECUTES — taps
// drive setState, initState runs, rebuilds render — headless via flutter
// widget tests. Hardware plugins stay behind the real-device gate.
describe('transpiled TSX behaves at runtime', () => {
  test('the counter increments when tapped', async () => {
    const appDir = await behaviorApp(
      '05-counter',
      'counter.dart',
      `import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/counter.dart';

void main() {
  testWidgets('increments on tap', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Counter()));
    expect(find.text('Count: 0'), findsOneWidget);

    await tester.tap(find.text('Increment'));
    await tester.pump();
    expect(find.text('Count: 1'), findsOneWidget);

    await tester.tap(find.text('Increment'));
    await tester.pump();
    expect(find.text('Count: 2'), findsOneWidget);
  });
}
`,
    );

    const result = await runFlutterTest(appDir);
    expect(result.exitCode).toBe(0);
  }, 900000);

  test('the mount effect runs before the first frame settles', async () => {
    const appDir = await behaviorApp(
      '06-mount-effect',
      'status.dart',
      `import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/status.dart';

void main() {
  testWidgets('initState applies the mount effect and taps count up', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: Status()));
    expect(find.text('Online'), findsOneWidget);
    expect(find.text('Offline'), findsNothing);
    expect(find.text('Checks: 0'), findsOneWidget);

    await tester.tap(find.text('Check'));
    await tester.pump();
    expect(find.text('Checks: 1'), findsOneWidget);
  });
}
`,
    );

    const result = await runFlutterTest(appDir);
    expect(result.exitCode).toBe(0);
  }, 900000);

  test('list rendering rebuilds when items are added', async () => {
    const appDir = await behaviorApp(
      '07-list-rendering',
      'groceries.dart',
      `import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/groceries.dart';

void main() {
  testWidgets('renders the list and appends on tap', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Groceries()));
    expect(find.text('Apples'), findsOneWidget);
    expect(find.text('Bread'), findsOneWidget);
    expect(find.text('Milk'), findsNothing);

    await tester.tap(find.text('Add'));
    await tester.pump();
    expect(find.text('Milk'), findsOneWidget);
  });
}
`,
    );

    const result = await runFlutterTest(appDir);
    expect(result.exitCode).toBe(0);
  }, 900000);
});
