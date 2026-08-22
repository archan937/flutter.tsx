import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import { FLUTTER_VERSION } from 'flutter-tsx';

const packageDir = join(import.meta.dir, '..', '..', 'packages', 'flutter-tsx');

// Downloads the full SDK archive (~2 GB): opt-in for pre-release verification.
const realNetworkEnabled = process.env.FSX_E2E_REAL === '1';

describe('fsx install (real network, pre-release gate)', () => {
  test.skipIf(!realNetworkEnabled)(
    'installs the pinned SDK from the official release index',
    async () => {
      const fsxHome = await mkdtemp(join(tmpdir(), 'fsx-e2e-real-'));

      const install = Bun.spawn(['bun', 'bin/fsx.ts', 'install'], {
        cwd: packageDir,
        env: { ...process.env, FSX_HOME: fsxHome },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      expect(await install.exited).toBe(0);

      const version = Bun.spawn(
        [join(fsxHome, 'flutter', 'bin', 'flutter'), '--version'],
        { stdout: 'pipe', stderr: 'ignore' },
      );
      const output = await new Response(version.stdout).text();
      expect(await version.exited).toBe(0);
      expect(output.split('\n')[0]).toBe(
        `Flutter ${FLUTTER_VERSION} • channel stable • ` +
          'https://github.com/flutter/flutter.git',
      );
    },
  );
});
