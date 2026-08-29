import { homedir } from 'node:os';

import { pathExists, readTextFile } from '../sdk/io';
import { readManifest, resolveFsxPaths } from '../sdk/manifest';
import { FLUTTER_VERSION } from '../sdk/version';
import { runDoctorCommand } from './doctor';

/** `fsx doctor` against the installed SDK, failing when anything is wrong. */
export const defaultDoctor = async (projectDir: string): Promise<void> => {
  const paths = resolveFsxPaths(process.env, homedir());

  const failures = await runDoctorCommand(projectDir, {
    readManifest: () => readManifest(paths.manifestPath),
    pinnedVersion: FLUTTER_VERSION,
    readFile: readTextFile,
    pathExists,
    out: (line: string): void => {
      process.stdout.write(`${line}\n`);
    },
  });
  if (failures !== 0) {
    throw new Error('fsx doctor found issues.');
  }
};
