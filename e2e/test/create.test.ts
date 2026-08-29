import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { buildWeb, dartBin, flutterBin, run } from './support/flutter-app';

const createBin = join(
  import.meta.dir,
  '..',
  '..',
  'packages',
  'create-flutter-tsx',
  'bin',
  'create.ts',
);

/**
 * `npm create flutter-tsx@latest my-app` through its real binary: the project
 * it writes compiles and builds, with nothing else done by hand.
 */
describe('create-flutter-tsx', () => {
  test('scaffolds a project that builds for the web', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'create-e2e-'));
    const appDir = join(parent, 'created-app');

    const proc = Bun.spawn(['bun', createBin, appDir], {
      cwd: parent,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Done. Next:');
    expect(stdout).toContain('  fsx dev');

    // The scaffolded project is the same one `fsx init` writes.
    for (const file of ['fsx.config.ts', 'src/App.tsx', 'lib/main.dart']) {
      expect(await Bun.file(join(appDir, file)).exists()).toBe(true);
    }

    const { defaultDevDeps, loadAppConfig } = await import('flutter-tsx/cli');
    await defaultDevDeps({ flutterBin, dartBin }).build(
      appDir,
      await loadAppConfig(appDir),
    );

    const analyzed = await run([flutterBin, 'analyze', '--no-pub'], appDir);
    expect(analyzed.exitCode).toBe(0);

    const build = await buildWeb(appDir);
    expect(build.exitCode).toBe(0);

    await rm(parent, { recursive: true, force: true });
  }, 900000);
});
