import { homedir } from 'node:os';
import { join } from 'node:path';

import { commandRunner, pathExists } from '../sdk/io';
import { resolveFsxPaths } from '../sdk/manifest';
import { runBuildCommand } from './build';
import { defaultDevDeps, loadAppConfig } from './dev';

/** `fsx build` wired to the installed SDK. */
export const defaultBuild = async (
  projectDir: string,
  args: string[],
): Promise<void> => {
  const paths = resolveFsxPaths(process.env, homedir());
  const flutterBin = join(paths.sdkDir, 'bin', 'flutter');
  const dartBin = join(paths.sdkDir, 'bin', 'dart');

  await runBuildCommand(projectDir, args, {
    loadConfig: loadAppConfig,
    build: defaultDevDeps({ flutterBin, dartBin }).build,
    runFlutter: commandRunner(flutterBin),
    pathExists,
    out: (line: string): void => {
      process.stdout.write(`${line}\n`);
    },
  });
};
