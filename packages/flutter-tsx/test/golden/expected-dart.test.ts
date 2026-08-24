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
