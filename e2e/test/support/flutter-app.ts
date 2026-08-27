import { mkdtemp } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const fsxHome = process.env.FSX_HOME ?? join(homedir(), '.fsx');
export const flutterBin = join(fsxHome, 'flutter', 'bin', 'flutter');

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

export const createFlutterWebApp = async (): Promise<string> => {
  const appDir = await mkdtemp(join(tmpdir(), 'fsx-e2e-app-'));
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
  return appDir;
};

export const addPubDependency = async (
  appDir: string,
  dependency: string,
): Promise<void> => {
  const added = await run([flutterBin, 'pub', 'add', dependency], appDir);
  if (added.exitCode !== 0) {
    throw new Error(
      `flutter pub add ${dependency} failed (exit ${added.exitCode}):\n${added.stderr}`,
    );
  }
};

export const buildWeb = (appDir: string): Promise<CommandResult> =>
  run([flutterBin, 'build', 'web'], appDir);

export const runFlutterTest = (appDir: string): Promise<CommandResult> =>
  run([flutterBin, 'test'], appDir);
