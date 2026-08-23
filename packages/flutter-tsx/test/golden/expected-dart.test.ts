import { beforeAll, describe, expect, test } from 'bun:test';

import { runCommand } from '@scripts/run-command';
import {
  dartFormatCheck,
  fixturesDir,
  fixturesPackageConfigPath,
  flutterAnalyze,
  flutterBin,
  listFixtures,
} from '@test/support/golden';

const fixtures = await listFixtures();

describe('committed golden expected.dart files', () => {
  beforeAll(async () => {
    if (await Bun.file(fixturesPackageConfigPath).exists()) {
      return;
    }
    const exitCode = await runCommand(
      [flutterBin(), 'pub', 'get'],
      fixturesDir,
    );
    if (exitCode !== 0) {
      throw new Error(
        `flutter pub get failed (exit ${exitCode}) in ${fixturesDir}`,
      );
    }
  }, 300000);

  test('at least conformance fixture #1 exists', () => {
    expect(fixtures.map((fixture) => fixture.id)).toEqual(['01-camera-screen']);
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
