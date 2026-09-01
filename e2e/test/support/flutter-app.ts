import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const fsxHome = process.env.FSX_HOME ?? join(homedir(), '.fsx');
export const flutterBin = join(fsxHome, 'flutter', 'bin', 'flutter');
export const dartBin = join(fsxHome, 'flutter', 'bin', 'dart');

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export const run = async (
  command: string[],
  cwd: string,
): Promise<CommandResult> => {
  const proc = Bun.spawn(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
};

const APP_PREFIX = 'fsx-e2e-app-';

const ownApps = new Set<string>();

// Each scaffolded app carries a pub cache and a web build (~50MB), so leaving
// them behind costs about a gigabyte per suite run and slowly starves the
// machine the builds run on. Previous runs' apps are swept on first use; this
// run's are kept, because a failed build's directory is worth inspecting.
const sweepStaleApps = async (): Promise<void> => {
  const root = tmpdir();
  const entries = await readdir(root).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith(APP_PREFIX))
      .map((entry) => join(root, entry))
      .filter((appDir) => !ownApps.has(appDir))
      .map((appDir) => rm(appDir, { recursive: true, force: true })),
  );
};

export const createFlutterWebApp = async (): Promise<string> => {
  if (ownApps.size === 0) {
    await sweepStaleApps();
  }
  const appDir = await mkdtemp(join(tmpdir(), APP_PREFIX));
  ownApps.add(appDir);
  const created = await run(
    [
      flutterBin,
      'create',
      '--platforms',
      'web',
      '--project-name',
      'fsx_e2e_app',
      '.',
    ],
    appDir,
  );
  if (created.exitCode !== 0) {
    throw new Error(
      `flutter create failed (exit ${created.exitCode}):\n${created.stderr}`,
    );
  }
  // The scaffold ships a widget test for its own template app, which stops
  // compiling the moment we replace main.dart. Tests here always bring their
  // own, so the template's would only ever be noise.
  await rm(join(appDir, 'test', 'widget_test.dart'), { force: true });
  return appDir;
};

// One `pub add` for the whole set: each invocation re-resolves the pubspec,
// so adding nine packages one by one costs nine resolutions.
export const addPubDependencies = async (
  appDir: string,
  dependencies: string[],
): Promise<void> => {
  if (dependencies.length === 0) {
    return;
  }
  const added = await run([flutterBin, 'pub', 'add', ...dependencies], appDir);
  if (added.exitCode !== 0) {
    throw new Error(
      `flutter pub add ${dependencies.join(' ')} failed ` +
        `(exit ${added.exitCode}):\n${added.stderr}`,
    );
  }
};

export const buildWeb = (appDir: string): Promise<CommandResult> =>
  run([flutterBin, 'build', 'web'], appDir);

/**
 * Builds an app for a platform this host can actually build for.
 *
 * Debug builds, because the point is that the Dart compiles and links into a
 * real bundle — a release build would only add signing and optimisation. iOS
 * builds for the simulator, which needs no signing identity. Returns null
 * when the host cannot build that platform at all, so the caller says so out
 * loud rather than passing quietly.
 */
export const buildNative = async (
  appDir: string,
  target: string,
): Promise<CommandResult | null> => {
  if (target === 'web') {
    return buildWeb(appDir);
  }
  if (process.platform !== 'darwin') {
    return null;
  }
  if (target === 'macos') {
    return run([flutterBin, 'build', 'macos', '--debug'], appDir);
  }
  if (target === 'ios') {
    return run([flutterBin, 'build', 'ios', '--simulator', '--debug'], appDir);
  }
  return null;
};

export const runFlutterTest = (appDir: string): Promise<CommandResult> =>
  run([flutterBin, 'test'], appDir);
