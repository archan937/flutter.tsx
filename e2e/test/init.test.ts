import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import {
  defaultDevDeps,
  defaultInitDeps,
  loadAppConfig,
  runInitCommand,
} from 'flutter-tsx/cli';

import { buildWeb, dartBin, flutterBin, run } from './support/flutter-app';

// The scaffolder's guarantee: what `fsx init` produces is a project that
// really builds — the starter component transpiles and the app compiles for
// the web.
describe('fsx init produces a project that builds', () => {
  test('scaffolds, transpiles its starter component and builds', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'fsx-init-'));
    const appDir = join(parent, 'demo-app');

    await runInitCommand(appDir, {
      ...defaultInitDeps(),
      out: () => undefined,
    });

    // Every scaffolded file is where the project expects it.
    for (const file of [
      '.gitignore',
      'fsx.config.ts',
      'package.json',
      'src/App.tsx',
      'tsconfig.json',
      'pubspec.yaml',
    ]) {
      expect(await Bun.file(join(appDir, file)).exists()).toBe(true);
    }

    const manifest = (await Bun.file(join(appDir, 'package.json')).json()) as {
      name: string;
      plugins: Record<string, string>;
    };
    expect(manifest.name).toBe('demo_app');
    expect(manifest.plugins).toEqual({});

    // `fsx dev` compiles the scaffolded project: every component plus the
    // entry point that runs it. Nothing is hand-written here.
    const config = await loadAppConfig(appDir);
    expect(config).toEqual({
      name: 'demo_app',
      bundleId: 'dev.fluttertsx.demoapp',
      target: 'web',
    });

    const built = await defaultDevDeps({
      flutterBin,
      dartBin,
    }).build(appDir, config);
    expect(built).toEqual(['app.dart']);

    expect(await Bun.file(join(appDir, 'lib', 'app.dart')).text()).toContain(
      'class App extends StatefulWidget',
    );
    expect(await Bun.file(join(appDir, 'lib', 'main.dart')).text()).toContain(
      "title: 'demo_app',",
    );

    const analyzed = await run([flutterBin, 'analyze', '--no-pub'], appDir);
    expect(analyzed.exitCode).toBe(0);

    const build = await buildWeb(appDir);
    expect(build.exitCode).toBe(0);

    await rm(parent, { recursive: true, force: true });
  }, 900000);
});
