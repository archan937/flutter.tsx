#!/usr/bin/env node
// `npm create flutter-tsx@latest my-app` runs this with whatever Node the
// user has, so this file is plain JavaScript — the scaffolder it hands over
// to is Bun code, like the compiler and the CLI it scaffolds a project for.
//
// Under Bun it simply runs. Under Node it finds Bun and hands over; when Bun
// is missing it says so, and how to get it, rather than failing as
// `env: bun: No such file or directory`.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = join(dirname(fileURLToPath(import.meta.url)), 'create.ts');

/** Where Bun is, if it is anywhere: its own install dir, then the PATH. */
const findBun = () => {
  const installed = [
    process.env.BUN_INSTALL === undefined
      ? null
      : join(process.env.BUN_INSTALL, 'bin', 'bun'),
    join(homedir(), '.bun', 'bin', 'bun'),
  ].find((candidate) => candidate !== null && existsSync(candidate));
  if (installed !== undefined) {
    return installed;
  }
  const onPath = spawnSync('bun', ['--version'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  return onPath.status === 0 ? 'bun' : null;
};

// `@types/bun` declares this version as always present; under Node it is
// not, which is the whole reason this file exists.
const runtime = /** @type {{ bun?: string }} */ (process.versions);

if (runtime.bun !== undefined) {
  await import(entry);
} else {
  const bun = findBun();
  if (bun === null) {
    process.stderr.write(
      'create-flutter-tsx needs Bun: it runs the TSX→Dart compiler and the ' +
        'fsx CLI.\n\nInstall it, then run this command again:\n\n' +
        '  curl -fsSL https://bun.sh/install | bash\n\n' +
        'Other platforms: https://bun.sh\n',
    );
    process.exit(1);
  }
  const scaffold = spawnSync(bun, [entry, ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
  process.exit(scaffold.status ?? 1);
}
