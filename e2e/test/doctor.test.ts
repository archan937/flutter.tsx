import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { defaultInitDeps, runInitCommand } from 'flutter-tsx/cli';

const packageDir = join(import.meta.dir, '..', '..', 'packages', 'flutter-tsx');

interface CliRun {
  stdout: string;
  exitCode: number;
}

const runFsx = async (args: string[], cwd: string): Promise<CliRun> => {
  const proc = Bun.spawn(['bun', join(packageDir, 'bin', 'fsx.ts'), ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
  ]);
  return { stdout, exitCode };
};

/**
 * `fsx doctor` through the real CLI: a scaffolded project passes, and a bare
 * directory fails with the reasons and the commands that fix them.
 */
describe('fsx doctor', () => {
  test('passes on a scaffolded project', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'fsx-doctor-'));
    const appDir = join(parent, 'doctor-app');

    await runInitCommand(appDir, {
      ...defaultInitDeps(),
      out: () => undefined,
    });

    const healthy = await runFsx(['doctor'], appDir);

    expect(healthy.stdout).toBe(
      [
        '[✓] Flutter SDK — 3.47.1',
        '[✓] Project — doctor_app',
        '[✓] Root component — src/App.tsx',
        '[✓] Plugins — none declared',
        'No issues found.',
        '',
      ].join('\n'),
    );
    expect(healthy.exitCode).toBe(0);

    await rm(parent, { recursive: true, force: true });
  }, 900000);

  test('fails outside a project, naming what is missing', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'fsx-doctor-empty-'));

    const run = await runFsx(['doctor'], empty);

    expect(run.stdout).toContain(
      '[✗] Project — no package.json here — run `fsx init`',
    );
    expect(run.stdout).toContain('[✗] Root component — src/App.tsx is missing');
    expect(run.stdout).toContain('3 issues found.');
    expect(run.exitCode).toBe(1);

    await rm(empty, { recursive: true, force: true });
  }, 300000);
});
