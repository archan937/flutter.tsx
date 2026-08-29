import { homedir } from 'node:os';
import { join } from 'node:path';

import { resolveFsxPaths } from '../sdk/manifest';
import { defaultDevDeps, runDevCommand } from './dev';

/** `fsx dev` wired to the installed SDK, exiting with flutter's own code. */
export const defaultDev = async (projectDir: string): Promise<void> => {
  const paths = resolveFsxPaths(process.env, homedir());
  const exitCode = await runDevCommand(
    projectDir,
    defaultDevDeps({
      flutterBin: join(paths.sdkDir, 'bin', 'flutter'),
      dartBin: join(paths.sdkDir, 'bin', 'dart'),
    }),
  );
  if (exitCode !== 0) {
    throw new Error(`flutter run exited with ${exitCode}.`);
  }
};
