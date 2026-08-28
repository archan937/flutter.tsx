import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import {
  defaultInitDeps,
  defaultPluginPhase,
  runInitCommand,
} from 'flutter-tsx/cli';
import { transpileComponent } from 'flutter-tsx/compiler';

import { buildWeb, flutterBin, run } from './support/flutter-app';

const PLUGIN = 'url_launcher';
const CONSTRAINT = '^6.3.0';

const COMPONENT = `import { launchUrl } from 'plugin:url_launcher';

export const Links = () => (
  <Center>
    <Text onClick={() => launchUrl('https://flutter.dev')}>Open</Text>
  </Center>
);
`;

const MAIN_DART = `import 'package:flutter/material.dart';

import 'links.dart';

void main() {
  runApp(const MaterialApp(home: Scaffold(body: Links())));
}
`;

/**
 * The whole promise of `fsx install` in one run: a project declares a plugin
 * in package.json and gets pub dependencies, typings and a building app —
 * against the real pub.dev and the real Flutter SDK.
 */
describe('fsx install — plugins declared in package.json', () => {
  test('installs the declared plugin, generates its typings and builds', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'fsx-plugins-'));
    const appDir = join(parent, 'plugin-app');

    await runInitCommand(appDir, {
      ...defaultInitDeps(),
      out: () => undefined,
    });

    const manifestPath = join(appDir, 'package.json');
    const manifest = (await Bun.file(manifestPath).json()) as {
      plugins: Record<string, string>;
    };
    manifest.plugins = { [PLUGIN]: CONSTRAINT };
    await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    await defaultPluginPhase().sync(appDir);

    // pubspec.yaml gained the dependency, and pub resolved it.
    expect(await Bun.file(join(appDir, 'pubspec.yaml')).text()).toContain(
      PLUGIN,
    );
    const lock = await Bun.file(join(appDir, 'pubspec.lock')).text();
    expect(lock).toContain(PLUGIN);

    // The typings a developer's IDE reads are real, and name the plugin module.
    const typingsPath = join(appDir, '.fsx', 'types', `${PLUGIN}.d.ts`);
    const typings = await Bun.file(typingsPath).text();
    expect(typings).toContain(`declare module 'plugin:${PLUGIN}'`);
    expect(typings).toContain('launchUrl');

    // The extraction the compiler reads is in the project.
    const extraction = (await Bun.file(
      join(appDir, '.fsx', 'api', `${PLUGIN}.json`),
    ).json()) as { package: string; version: string };
    expect(extraction.package).toBe(PLUGIN);
    expect(extraction.version).toBe('6.3.2');

    // What fsx installed is recorded, so a second run is a no-op.
    expect(await Bun.file(join(appDir, '.fsx', 'plugins.json')).json()).toEqual(
      {
        [PLUGIN]: CONSTRAINT,
      },
    );

    // A component importing the plugin compiles to Dart that analyzes and builds.
    const inputPath = join(appDir, 'src', 'Links.tsx');
    await Bun.write(inputPath, COMPONENT);
    // Compiled against the project's own extraction, not any API bundled
    // with flutter-tsx.
    const generated = await transpileComponent({
      source: COMPONENT,
      filePath: inputPath,
      pluginApiDirs: [join(appDir, '.fsx', 'api')],
    });
    expect(generated).toContain(`import 'package:${PLUGIN}/${PLUGIN}.dart'`);

    await Bun.write(join(appDir, 'lib', 'links.dart'), generated);
    await Bun.write(join(appDir, 'lib', 'main.dart'), MAIN_DART);
    await rm(join(appDir, 'test'), { recursive: true, force: true });

    const analyzed = await run([flutterBin, 'analyze', '--no-pub'], appDir);
    expect(analyzed.exitCode).toBe(0);

    const build = await buildWeb(appDir);
    expect(build.exitCode).toBe(0);

    await rm(parent, { recursive: true, force: true });
  }, 900000);
});
