import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import { runCommand } from '@scripts/run-command';
import { resolveFsxPaths } from '@src/sdk/manifest';

const paths = resolveFsxPaths(process.env, homedir());
const extractorDir = new URL('../extractor', import.meta.url).pathname;
const committedPath = new URL('../ref/api.json', import.meta.url).pathname;
const freshPath = join(tmpdir(), `fsx-verify-api-${process.pid}.json`);

const extractExit = await runCommand(
  [
    join(paths.sdkDir, 'bin', 'dart'),
    'run',
    'bin/extract.dart',
    '--flutter-path',
    paths.sdkDir,
    '--out',
    freshPath,
  ],
  extractorDir,
);
if (extractExit !== 0) {
  process.exit(extractExit);
}

const [committed, fresh] = await Promise.all([
  Bun.file(committedPath).text(),
  Bun.file(freshPath).text(),
]);

if (committed !== fresh) {
  process.stderr.write(
    `✖ ref/api.json is stale or hand-edited: a fresh extraction differs.\n` +
      `  Regenerate with \`bun run extract\` and review the diff.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  '✓ ref/api.json matches a fresh extraction byte-for-byte\n',
);
