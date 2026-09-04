import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, test } from 'bun:test';

/**
 * The published entry point, which Node runs.
 *
 * `npm create flutter-tsx@latest my-app` starts under whatever Node the user
 * has, while the scaffolder — like the compiler and the CLI — is Bun code.
 * The launcher is what bridges the two, so it is exercised the way npm runs
 * it: as a process, under both runtimes.
 */
const launcher = new URL('../bin/create.mjs', import.meta.url).pathname;

const run = async (
  command: string[],
  environment: Record<string, string | undefined> = {},
): Promise<{ code: number; out: string; err: string }> => {
  const child = Bun.spawn(command, {
    env: { ...process.env, ...environment },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, out, err };
};

/** Where Node is, so a test can keep it while taking Bun away. */
const nodePath = Bun.which('node');

describe('the published launcher', () => {
  test('runs the scaffolder when Bun runs it', async () => {
    // No directory: the scaffolder says how it is called, which proves it
    // ran rather than that something scaffolded.
    const { code, err } = await run(['bun', launcher]);

    expect(err).toContain('usage: create-flutter-tsx <directory>');
    expect(code).toBe(1);
  }, 60000);

  test('hands over to Bun when Node runs it', async () => {
    // This is the real `npm create` path: Node starts, Bun finishes.
    if (nodePath === null) throw new Error('node is not installed');
    const { code, err } = await run([nodePath, launcher]);

    expect(err).toContain('usage: create-flutter-tsx <directory>');
    expect(code).toBe(1);
  }, 60000);

  test('says how to install Bun when there is none', async () => {
    // A machine without Bun would otherwise fail as `env: bun: No such file
    // or directory`, which tells a newcomer nothing.
    if (nodePath === null) throw new Error('node is not installed');
    const withoutBun = await mkdtemp(join(tmpdir(), 'fsx-no-bun-'));
    const home = await mkdtemp(join(tmpdir(), 'fsx-home-'));
    // A `bun` on the PATH that cannot answer for its version is no Bun.
    await writeFile(join(withoutBun, 'bun'), '#!/bin/sh\nexit 1\n', {
      mode: 0o755,
    });

    const { code, err } = await run([nodePath, launcher, 'my-app'], {
      PATH: `${dirname(nodePath)}:${withoutBun}`,
      HOME: home,
      BUN_INSTALL: join(home, '.bun'),
    });

    expect(err).toContain('create-flutter-tsx needs Bun');
    expect(err).toContain('https://bun.sh/install');
    expect(code).toBe(1);

    await rm(withoutBun, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }, 60000);
});
