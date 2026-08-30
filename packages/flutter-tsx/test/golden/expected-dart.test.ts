import { beforeAll, describe, expect, test } from 'bun:test';

import {
  dartFormatCheck,
  ensurePackageResolved,
  fixturesDir,
  flutterAnalyze,
  listFixtures,
} from '@test/support/golden';

const fixtures = await listFixtures();

describe('committed golden expected.dart files', () => {
  beforeAll(async () => {
    await ensurePackageResolved(fixturesDir);
  }, 300000);

  test('the conformance fixtures are exactly the committed set', () => {
    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      '01-camera-screen',
      '02-hello-column',
      '03-styled-container',
      '04-inline-handler',
      '05-counter',
      '06-mount-effect',
      '07-list-rendering',
      '08-composition',
      '09-typed-props',
      '10-camera-options',
      '11-preferences',
      '12-secure-storage',
      '13-open-link',
      '14-app-info',
      '15-front-camera',
      '16-tap-target',
      '17-async-token',
      '18-connectivity-stream',
      '19-store-counter',
      '20-router',
      '21-modal',
      '22-mount-dialog',
      '23-tabs',
      '24-animated',
      '25-http-get',
      '26-json-model',
      '27-inline-plugin-call',
      '28-multi-file',
      '29-branching-handler',
      '30-list-prop',
      '31-model-list',
      '32-value-methods',
      '33-control-flow',
      '34-list-pipeline',
      '35-helpers',
      '36-enums',
      '37-tuples-generics',
      '38-effect-cleanup',
      '39-builder-callback',
      '40-layout-builder',
      '41-model-helper',
      '42-project-layout',
    ]);
  });

  for (const fixture of fixtures) {
    test(`${fixture.id}/expected.dart is dart-format-stable`, async () => {
      expect(await dartFormatCheck(fixture.expectedPath)).toBe(0);
    }, 60000);
  }

  test('the fixtures package analyzes with zero issues (flutter_lints)', async () => {
    expect(await flutterAnalyze()).toBe(0);
  }, 300000);
});

describe('golden top-level names', () => {
  test('no two fixtures declare the same top-level Dart name', async () => {
    // One app imports every fixture library at once, so a name declared by
    // two of them is an ambiguous import there — a broken build that no
    // single fixture is wrong about.
    const declared = new Map<string, string>();
    const clashes: string[] = [];
    // Column-0 declarations only: an indented line is a member, not a
    // top-level name.
    const declaration =
      /^(?:abstract\s+final\s+)?(?:class|enum|mixin|extension)\s+(\w+)|^[A-Za-z_][\w<>,?]*\s+(\w+)\(/;

    for (const fixture of fixtures) {
      const dart = await Bun.file(fixture.expectedPath).text();
      for (const line of dart.split('\n')) {
        const match = declaration.exec(line);
        const name = match?.[1] ?? match?.[2];
        if (name === undefined || name === 'main') continue;
        const owner = declared.get(name);
        if (owner !== undefined && owner !== fixture.id) {
          clashes.push(`${name}: ${owner} and ${fixture.id}`);
        }
        declared.set(name, fixture.id);
      }
    }

    expect(clashes).toEqual([]);
  });
});
