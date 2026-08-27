import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { transpileComponent } from 'flutter-tsx/compiler';

import { FIXTURE_APPS } from '../fixtures/manifest';
import {
  addPubDependencies,
  buildWeb,
  createFlutterWebApp,
  runFlutterTest,
} from './support/flutter-app';

const fixturesDir = join(
  import.meta.dir,
  '..',
  '..',
  'packages',
  'flutter-tsx',
  'test',
  'fixtures',
);

const behaviorDir = join(import.meta.dir, '..', 'fixtures', 'behavior');

// Referencing each type forces every generated library to be compiled and
// type-checked without having to satisfy required props.
const mainDart = (): string => {
  const imports = FIXTURE_APPS.map(
    (fixture) => `import '${fixture.dartFile}';`,
  ).join('\n');
  const components = FIXTURE_APPS.map(
    (fixture) => `  ${fixture.component},`,
  ).join('\n');
  return `import 'package:flutter/material.dart';

${imports}

const List<Type> fixtures = <Type>[
${components}
];

void main() {
  runApp(
    MaterialApp(home: Scaffold(body: Text('fixtures: \${fixtures.length}'))),
  );
}
`;
};

// One app hosts every fixture, so create/pub/test/build each run once for the
// whole suite. Per-fixture compilability is not weakened: the goldens are
// byte-equal here and the 543-widget sweep analyzes every probe on its own.
describe('every fixture builds and behaves in a real Flutter app', () => {
  test('transpiles byte-equal, runs its widget tests, builds for web', async () => {
    const appDir = await createFlutterWebApp();
    const deps = [
      ...new Set(
        FIXTURE_APPS.flatMap((fixture) => [
          ...fixture.deps,
          ...(fixture.testDeps ?? []),
        ]),
      ),
    ].sort();
    await addPubDependencies(appDir, deps);

    for (const fixture of FIXTURE_APPS) {
      const inputPath = join(fixturesDir, fixture.id, 'input.tsx');
      const generated = await transpileComponent({
        source: await Bun.file(inputPath).text(),
        filePath: inputPath,
      });
      const golden = await Bun.file(
        join(fixturesDir, fixture.id, 'expected.dart'),
      ).text();
      expect(generated).toBe(golden);

      await Bun.write(join(appDir, 'lib', fixture.dartFile), generated);
      if (fixture.behavior === true) {
        const widgetTest = await Bun.file(
          join(behaviorDir, `${fixture.id}.dart`),
        ).text();
        await Bun.write(
          join(appDir, 'test', `${fixture.id.replaceAll('-', '_')}_test.dart`),
          widgetTest,
        );
      }
    }
    await Bun.write(join(appDir, 'lib', 'main.dart'), mainDart());

    const behavior = await runFlutterTest(appDir);
    expect(behavior.exitCode).toBe(0);

    const build = await buildWeb(appDir);
    expect(build.exitCode).toBe(0);
    expect(
      await Bun.file(join(appDir, 'build', 'web', 'main.dart.js')).exists(),
    ).toBe(true);
  }, 1800000);
});
