import { homedir } from 'node:os';
import { join } from 'node:path';

import { runCommand } from '@scripts/run-command';
import { pathExists } from '@src/sdk/io';
import { resolveFsxPaths } from '@src/sdk/manifest';

const paths = resolveFsxPaths(process.env, homedir());
const extractorDir = new URL('../extractor', import.meta.url).pathname;

const packageConfig = join(paths.sdkDir, '.dart_tool', 'package_config.json');
if (!(await pathExists(packageConfig))) {
  const updateExit = await runCommand(
    [join(paths.sdkDir, 'bin', 'flutter'), 'update-packages'],
    paths.sdkDir,
  );
  if (updateExit !== 0) {
    process.exit(updateExit);
  }
}

process.exit(
  await runCommand(
    [
      join(paths.sdkDir, 'bin', 'dart'),
      'run',
      'bin/extract.dart',
      '--flutter-path',
      paths.sdkDir,
      '--out',
      '../ref/api.json',
    ],
    extractorDir,
  ),
);
