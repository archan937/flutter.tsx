import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import {
  defaultDevDeps,
  defaultInitDeps,
  loadAppConfig,
  runInitCommand,
  TEMPLATE_NAMES,
  TEMPLATES,
} from 'flutter-tsx/cli';

import {
  addPubDependencies,
  buildNative,
  buildWeb,
  dartBin,
  flutterBin,
  run,
  runFlutterTest,
} from './support/flutter-app';

const behaviorDir = join(
  import.meta.dir,
  '..',
  'fixtures',
  'template-behavior',
);

/**
 * Packages a template's widget test needs and the app itself does not: the
 * platform interfaces its fakes implement.
 */
const TEST_DEPENDENCIES: Readonly<Record<string, string[]>> = {
  tray: ['connectivity_plus_platform_interface', 'plugin_platform_interface'],
};

/**
 * The templates' guarantee: `fsx init --template=<name>` produces an app that
 * really builds.
 *
 * Every template is scaffolded into a temporary directory, transpiled by the
 * same code `fsx dev` runs, analysed by `flutter analyze` and — where the
 * platform allows it on any machine — built. A template that stopped
 * compiling would fail here rather than in a newcomer's terminal.
 */
describe('every template scaffolds into an app that builds', () => {
  // Each template is built for the web so the gate runs on any machine; the
  // desktop and mobile templates declare their own target, which is what
  // `flutter create` was asked for, and the Dart is the same either way.
  for (const name of TEMPLATE_NAMES) {
    test(`--template=${name} transpiles, analyzes and builds`, async () => {
      const parent = await mkdtemp(join(tmpdir(), `fsx-template-${name}-`));
      const appDir = join(parent, `${name}-app`);

      await runInitCommand(
        appDir,
        { ...defaultInitDeps(), out: () => undefined },
        { template: name, target: 'web' },
      );

      const config = await loadAppConfig(appDir);
      expect(config.target).toBe('web');

      const built = await defaultDevDeps({ flutterBin, dartBin }).build(
        appDir,
        config,
      );
      expect(built.length).toBeGreaterThan(0);

      const analyzed = await run([flutterBin, 'analyze', '--no-pub'], appDir);
      if (analyzed.exitCode !== 0) {
        throw new Error(
          `flutter analyze failed for the ${name} template:\n` +
            `${analyzed.stdout}\n${analyzed.stderr}`,
        );
      }

      // Building proves it compiles; running it proves it works. Each app is
      // driven the way a person drives it — tapping, typing, and receiving
      // the events its plugins would deliver.
      await addPubDependencies(appDir, TEST_DEPENDENCIES[name] ?? []);
      await Bun.write(
        join(appDir, 'test', 'template_test.dart'),
        await Bun.file(join(behaviorDir, `${name}.dart`)).text(),
      );
      const behaviour = await runFlutterTest(appDir);
      if (behaviour.exitCode !== 0) {
        throw new Error(
          `the ${name} template does not behave:\n` +
            `${behaviour.stdout}\n${behaviour.stderr}`,
        );
      }

      const build = await buildWeb(appDir);
      if (build.exitCode !== 0) {
        throw new Error(
          `flutter build web failed for the ${name} template:\n` +
            `${build.stdout}\n${build.stderr}`,
        );
      }

      await rm(parent, { recursive: true, force: true });
    }, 1800000);

    // The web build above runs everywhere; this one builds the template for
    // the platform it is actually written for, on a host that can.
    const target = TEMPLATES[name]?.target ?? 'web';
    test(`--template=${name} builds for ${target}`, async () => {
      const parent = await mkdtemp(join(tmpdir(), `fsx-native-${name}-`));
      const appDir = join(parent, `${name}-app`);

      await runInitCommand(
        appDir,
        { ...defaultInitDeps(), out: () => undefined },
        { template: name },
      );

      const config = await loadAppConfig(appDir);
      await defaultDevDeps({ flutterBin, dartBin }).build(appDir, config);

      const build = await buildNative(appDir, config.target);
      if (build === null) {
        throw new Error(
          `this host cannot build ${config.target}, so the ${name} ` +
            'template is unproven on the platform it targets.',
        );
      }
      if (build.exitCode !== 0) {
        throw new Error(
          `flutter build ${config.target} failed for the ${name} ` +
            `template:\n${build.stdout}\n${build.stderr}`,
        );
      }

      await rm(parent, { recursive: true, force: true });
    }, 1800000);
  }
});
