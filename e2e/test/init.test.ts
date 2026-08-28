import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { defaultInitDeps, runInitCommand } from 'flutter-tsx/cli';
import { transpileComponent } from 'flutter-tsx/compiler';

import { buildWeb, flutterBin, run } from './support/flutter-app';

const MAIN_DART = `import 'package:flutter/material.dart';

import 'app.dart';

void main() {
  runApp(const MaterialApp(home: Scaffold(body: Center(child: App()))));
}
`;

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

    // The starter component is real TSX that the compiler accepts.
    const inputPath = join(appDir, 'src', 'App.tsx');
    const generated = await transpileComponent({
      source: await Bun.file(inputPath).text(),
      filePath: inputPath,
    });
    expect(generated).toContain('class App extends StatefulWidget');

    await Bun.write(join(appDir, 'lib', 'app.dart'), generated);
    await Bun.write(join(appDir, 'lib', 'main.dart'), MAIN_DART);
    await rm(join(appDir, 'test'), { recursive: true, force: true });

    const analyzed = await run([flutterBin, 'analyze', '--no-pub'], appDir);
    expect(analyzed.exitCode).toBe(0);

    const build = await buildWeb(appDir);
    expect(build.exitCode).toBe(0);

    await rm(parent, { recursive: true, force: true });
  }, 900000);
});
