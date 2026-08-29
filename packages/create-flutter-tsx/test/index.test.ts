import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  CREATE_FLUTTER_TSX_VERSION,
  type CreateIo,
  defaultCreateIo,
  runCreate,
} from '@src/index';

const captureIo = (): CreateIo & { outLines: string[]; errLines: string[] } => {
  const outLines: string[] = [];
  const errLines: string[] = [];
  return {
    outLines,
    errLines,
    out: (line: string): void => {
      outLines.push(line);
    },
    err: (line: string): void => {
      errLines.push(line);
    },
  };
};

describe('public API surface', () => {
  test('exposes the package version, in sync with package.json', async () => {
    const manifestPath = new URL('../package.json', import.meta.url);
    const manifest = (await Bun.file(manifestPath).json()) as {
      version: string;
    };

    expect(CREATE_FLUTTER_TSX_VERSION).toBe(manifest.version);
  });
});

describe('runCreate', () => {
  test('scaffolds a project through the installed SDK', async () => {
    const home = await mkdtemp(join(tmpdir(), 'create-home-'));
    const flutter = join(home, 'flutter', 'bin', 'flutter');
    // A stub SDK: the scaffolder only needs `flutter create` to succeed.
    await Bun.write(flutter, '#!/bin/sh\nexit 0\n');
    await chmod(flutter, 0o755);
    const parent = await mkdtemp(join(tmpdir(), 'create-app-'));
    const appDir = join(parent, 'my-app');
    const previous = process.env.FSX_HOME;
    process.env.FSX_HOME = home;
    const io = captureIo();

    try {
      expect(await runCreate([appDir], io)).toBe(0);
      expect(io.errLines).toEqual([]);
      expect(io.outLines[0]).toBe(`Creating ${appDir}…`);
      expect(io.outLines[io.outLines.length - 1]).toBe('  fsx dev');
      expect(await Bun.file(join(appDir, 'src', 'App.tsx')).exists()).toBe(
        true,
      );
    } finally {
      if (previous === undefined) delete process.env.FSX_HOME;
      else process.env.FSX_HOME = previous;
      await rm(home, { recursive: true, force: true });
      await rm(parent, { recursive: true, force: true });
    }
  }, 60000);

  test('reports usage when no directory is named', async () => {
    const io = captureIo();

    expect(await runCreate([], io)).toBe(1);
    expect(io.errLines).toEqual(['usage: create-flutter-tsx <directory>']);
  });

  test('writes to the real streams by default', () => {
    const lines: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    const writeErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk: string): boolean => {
      lines.push(`out:${chunk}`);
      return true;
    };
    process.stderr.write = (chunk: string): boolean => {
      lines.push(`err:${chunk}`);
      return true;
    };
    try {
      const io = defaultCreateIo();
      io.out('hello');
      io.err('oops');
    } finally {
      process.stdout.write = write;
      process.stderr.write = writeErr;
    }

    expect(lines).toEqual(['out:hello\n', 'err:oops\n']);
  });
});
