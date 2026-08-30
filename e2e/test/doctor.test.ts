import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import {
  defaultInitDeps,
  defaultPluginPhase,
  runInitCommand,
} from 'flutter-tsx/cli';

import { flutterBin, run } from './support/flutter-app';

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
        '[✓] iOS usage descriptions — no plugin needs one',
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

  /**
   * The check that matters on a real host app: camera needs two Info.plist
   * keys, and nothing but the developer can supply their purpose strings.
   * Everything here is real — pub resolves camera, the extractor reads its
   * example Info.plist, and `flutter create` writes the iOS host.
   */
  test('names the iOS keys a real plugin needs, and passes once they exist', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'fsx-doctor-ios-'));
    const appDir = join(parent, 'camera-app');

    await runInitCommand(appDir, {
      ...defaultInitDeps(),
      out: () => undefined,
    });

    const manifestPath = join(appDir, 'package.json');
    const manifest = (await Bun.file(manifestPath).json()) as {
      plugins: Record<string, string>;
    };
    manifest.plugins = { camera: '^0.11.0' };
    await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await defaultPluginPhase().sync(appDir);

    // `fsx init` scaffolds web only; an iOS host is what makes the keys due.
    const created = await run(
      [flutterBin, 'create', '--platforms', 'ios', '.'],
      appDir,
    );
    expect(created.exitCode).toBe(0);

    const plistPath = join(appDir, 'ios', 'Runner', 'Info.plist');
    const scaffolded = await Bun.file(plistPath).text();
    // `flutter create` writes no usage descriptions of its own.
    expect(scaffolded).not.toContain('NSCameraUsageDescription');

    const missing = await runFsx(['doctor'], appDir);
    expect(missing.stdout).toContain(
      '[✗] iOS usage descriptions — NSCameraUsageDescription, ' +
        'NSMicrophoneUsageDescription missing from ios/Runner/Info.plist — ' +
        'add them with your own purpose strings',
    );
    expect(missing.exitCode).toBe(1);

    await Bun.write(
      plistPath,
      scaffolded.replace(
        '</dict>',
        [
          '\t<key>NSCameraUsageDescription</key>',
          '\t<string>Take photos in the app.</string>',
          '\t<key>NSMicrophoneUsageDescription</key>',
          '\t<string>Record audio with video.</string>',
          '</dict>',
        ].join('\n'),
      ),
    );

    const declared = await runFsx(['doctor'], appDir);
    expect(declared.stdout).toContain(
      '[✓] iOS usage descriptions — 2 declared',
    );
    expect(declared.exitCode).toBe(0);

    await rm(parent, { recursive: true, force: true });
  }, 900000);
});
