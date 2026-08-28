import { mkdir, mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { FLUTTER_VERSION } from 'flutter-tsx';

const ARCHIVE_PATH = 'stable/test/fsx-e2e-flutter.tar.gz';
const FAKE_FLUTTER_BINARY = '#!/bin/sh\necho "fake flutter for fsx e2e"\n';
const TAMPERED_SHA = 'deadbeef';

const packageDir = join(import.meta.dir, '..', '..', 'packages', 'flutter-tsx');

const releaseTarget = ((): { os: string; arch: string } => {
  const osByPlatform: Record<string, string> = {
    darwin: 'macos',
    linux: 'linux',
    win32: 'windows',
  };
  return {
    os: osByPlatform[process.platform] ?? 'unknown',
    arch: process.arch,
  };
})();

let server: ReturnType<typeof Bun.serve>;
let archiveSha256: string;

const releasesIndex = (baseUrl: string, sha256: string): object => ({
  base_url: baseUrl,
  releases: ['x64', 'arm64'].map((arch) => ({
    hash: 'fsx-e2e-hash',
    channel: 'stable',
    version: FLUTTER_VERSION,
    dart_sdk_arch: arch,
    archive: ARCHIVE_PATH,
    sha256,
  })),
});

interface CliRun {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const runFsxInstall = async (
  fsxHome: string,
  baseUrl: string,
  cwd: string,
): Promise<CliRun> => {
  const proc = Bun.spawn(
    ['bun', join(packageDir, 'bin', 'fsx.ts'), 'install'],
    {
      cwd,
      env: { ...process.env, FSX_HOME: fsxHome, FSX_RELEASES_URL: baseUrl },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
};

beforeAll(async () => {
  const buildDir = await mkdtemp(join(tmpdir(), 'fsx-e2e-sdk-'));
  await mkdir(join(buildDir, 'flutter', 'bin'), { recursive: true });
  await Bun.write(
    join(buildDir, 'flutter', 'bin', 'flutter'),
    FAKE_FLUTTER_BINARY,
  );
  const archiveFile = join(buildDir, 'sdk.tar.gz');
  const tar = Bun.spawn([
    'tar',
    '-czf',
    archiveFile,
    '-C',
    buildDir,
    'flutter',
  ]);
  expect(await tar.exited).toBe(0);

  const archiveBytes = await Bun.file(archiveFile).arrayBuffer();
  archiveSha256 = new Bun.CryptoHasher('sha256')
    .update(archiveBytes)
    .digest('hex');

  server = Bun.serve({
    port: 0,
    fetch: (request) => {
      const { pathname } = new URL(request.url);
      if (/^\/releases_(macos|linux|windows)\.json$/.test(pathname)) {
        return Response.json(releasesIndex(server.url.origin, archiveSha256));
      }
      if (/^\/bad\/releases_(macos|linux|windows)\.json$/.test(pathname)) {
        return Response.json(
          releasesIndex(`${server.url.origin}/bad`, TAMPERED_SHA),
        );
      }
      if (
        pathname === `/${ARCHIVE_PATH}` ||
        pathname === `/bad/${ARCHIVE_PATH}`
      ) {
        return new Response(Bun.file(archiveFile));
      }
      return new Response('not found', { status: 404 });
    },
  });
});

afterAll(async () => {
  await server.stop(true);
});

describe('fsx install (hermetic end to end)', () => {
  test('installs, verifies, and is idempotent through the real CLI', async () => {
    const fsxHome = await mkdtemp(join(tmpdir(), 'fsx-e2e-home-'));
    // Run outside any project so this stays a pure SDK-install test. The real
    // path is what the CLI reports, since macOS resolves /var to /private/var.
    const outsideProject = await realpath(
      await mkdtemp(join(tmpdir(), 'fsx-e2e-outside-')),
    );
    const { origin } = server.url;

    const firstRun = await runFsxInstall(fsxHome, origin, outsideProject);

    expect(firstRun.stderr).toBe('');
    expect(firstRun.exitCode).toBe(0);
    expect(firstRun.stdout).toBe(
      `Resolving Flutter ${FLUTTER_VERSION} for ` +
        `${releaseTarget.os}-${releaseTarget.arch}…\n` +
        `Downloading ${origin}/${ARCHIVE_PATH}…\n` +
        'Extracting…\n' +
        `Flutter ${FLUTTER_VERSION} installed at ${fsxHome}/flutter\n` +
        `No package.json in ${outsideProject} — installed the SDK only.\n`,
    );

    const installedBinary = join(fsxHome, 'flutter', 'bin', 'flutter');
    expect(await Bun.file(installedBinary).text()).toBe(FAKE_FLUTTER_BINARY);

    const manifest = (await Bun.file(
      join(fsxHome, 'sdk-manifest.json'),
    ).json()) as Record<string, string>;
    expect(manifest).toEqual({
      flutterVersion: FLUTTER_VERSION,
      archive: ARCHIVE_PATH,
      sha256: archiveSha256,
      installedAt: manifest.installedAt ?? '',
    });
    expect(manifest.installedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    const secondRun = await runFsxInstall(fsxHome, origin, outsideProject);

    expect(secondRun.stderr).toBe('');
    expect(secondRun.exitCode).toBe(0);
    expect(secondRun.stdout).toBe(
      `Flutter ${FLUTTER_VERSION} already installed at ${fsxHome}/flutter\n` +
        `No package.json in ${outsideProject} — installed the SDK only.\n`,
    );
  });

  test('rejects a tampered checksum through the real CLI', async () => {
    const fsxHome = await mkdtemp(join(tmpdir(), 'fsx-e2e-tampered-'));

    const run = await runFsxInstall(
      fsxHome,
      `${server.url.origin}/bad`,
      await mkdtemp(join(tmpdir(), 'fsx-e2e-outside-')),
    );

    expect(run.exitCode).toBe(1);
    expect(run.stderr).toBe(
      `checksum mismatch for ${ARCHIVE_PATH}: ` +
        `expected ${TAMPERED_SHA}, got ${archiveSha256}\n`,
    );
    expect(await Bun.file(join(fsxHome, 'sdk-manifest.json')).exists()).toBe(
      false,
    );
  });
});
