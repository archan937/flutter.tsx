import { homedir } from 'node:os';
import { join } from 'node:path';

import { runCommand } from '@scripts/run-command';
import { pathExists } from '@src/sdk/io';
import { resolveFsxPaths } from '@src/sdk/manifest';

const packageName = process.argv[2];
if (packageName === undefined) {
  console.error('usage: bun scripts/extract-plugin.ts <pub-package>');
  process.exit(2);
}

const paths = resolveFsxPaths(process.env, homedir());
const extractorDir = new URL('../extractor', import.meta.url).pathname;
const projectDir = new URL('../test/fixtures', import.meta.url).pathname;
const outPath = new URL(`../ref/plugins/${packageName}.json`, import.meta.url)
  .pathname;

if (
  !(await pathExists(join(projectDir, '.dart_tool', 'package_config.json')))
) {
  const pubGetExit = await runCommand(
    [join(paths.sdkDir, 'bin', 'flutter'), 'pub', 'get'],
    projectDir,
  );
  if (pubGetExit !== 0) {
    process.exit(pubGetExit);
  }
}

process.exit(
  await runCommand(
    [
      join(paths.sdkDir, 'bin', 'dart'),
      'run',
      'bin/extract_plugin.dart',
      '--package',
      packageName,
      '--project',
      projectDir,
      '--sdk-path',
      join(paths.sdkDir, 'bin', 'cache', 'dart-sdk'),
      '--out',
      outPath,
    ],
    extractorDir,
  ),
);
