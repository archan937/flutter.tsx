import { mkdtemp, rm } from 'node:fs/promises';
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
      // A freshly downloaded SDK prints an "a new version is available"
      // banner before the version itself, so the line is found rather than
      // assumed to be first — and then matched in full.
      expect(
        output.split('\n').find((line) => line.startsWith('Flutter ')),
      ).toBe(
        `Flutter ${FLUTTER_VERSION} • channel stable • ` +
          'https://github.com/flutter/flutter.git',
      );

      // A whole SDK is ~2 GB; leaving one behind per run fills a disk.
      await rm(fsxHome, { recursive: true, force: true });
    },
    1800000,
  );
});
