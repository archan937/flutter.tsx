import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { defaultInitDeps } from '@src/cli/init';
import {
  buildCommands,
  type CliIo,
  defaultCliIo,
  formatError,
  runCli,
} from '@src/cli/run';

interface CapturedIo extends CliIo {
  outLines: string[];
  errLines: string[];
}

const captureIo = (): CapturedIo => {
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

const EXPECTED_USAGE = [
  'Usage: fsx <command> [arguments]',
  '',
  'Commands:',
  '  install        Download the pinned Flutter SDK to ~/.fsx/flutter',
  '  init <dir>     Scaffold a new Flutter.tsx project',
].join('\n');

describe('runCli', () => {
  test('prints usage and fails when no command is given', async () => {
    const io = captureIo();

    expect(await runCli([], io, {})).toBe(1);
    expect(io.errLines).toEqual([EXPECTED_USAGE]);
  });

  test('rejects unknown commands', async () => {
    const io = captureIo();

    expect(await runCli(['frobnicate'], io, {})).toBe(1);
    expect(io.errLines).toEqual([
      `Unknown command: frobnicate\n\n${EXPECTED_USAGE}`,
    ]);
  });

  test('runs a known command and returns 0', async () => {
    const io = captureIo();
    let ran = false;

    const code = await runCli(['install'], io, {
      install: () => {
        ran = true;
        return Promise.resolve();
      },
    });

    expect(code).toBe(0);
    expect(ran).toBe(true);
  });

  test('reports command failures on stderr and returns 1', async () => {
    const io = captureIo();

    const code = await runCli(['install'], io, {
      install: () => Promise.reject(new Error('network unreachable')),
    });

    expect(code).toBe(1);
    expect(io.errLines).toEqual(['network unreachable']);
  });

  test('formatError extracts Error messages and stringifies the rest', () => {
    expect(formatError(new Error('network unreachable'))).toBe(
      'network unreachable',
    );
    expect(formatError('plain string failure')).toBe('plain string failure');
    expect(formatError(42)).toBe('42');
  });

  test('default IO writes to stdout and stderr without throwing', () => {
    expect(() => {
      defaultCliIo.out('fsx test line (stdout)');
      defaultCliIo.err('fsx test line (stderr)');
    }).not.toThrow();
  });
});

describe('runCli — command arguments', () => {
  test('passes everything after the command to the runner', async () => {
    const io = captureIo();
    const seen: string[][] = [];

    const code = await runCli(['init', 'demo-app', '--flag'], io, {
      init: (args) => {
        seen.push(args);
        return Promise.resolve();
      },
    });

    expect(code).toBe(0);
    expect(seen).toEqual([['demo-app', '--flag']]);
  });
});

describe('runCli — the built-in init command', () => {
  test('reports the missing directory instead of scaffolding nowhere', async () => {
    const io = captureIo();

    const code = await runCli(['init'], io);

    expect(code).toBe(1);
    expect(io.errLines).toEqual([
      'fsx init needs a directory: `fsx init my-app`.',
    ]);
  });

  test('refuses to scaffold before the SDK is installed', async () => {
    const home = await mkdtemp(join(tmpdir(), 'fsx-run-'));
    const previous = process.env.FSX_HOME;
    process.env.FSX_HOME = home;
    const io = captureIo();
    try {
      const code = await runCli(['init', join(home, 'demo')], io);

      expect(code).toBe(1);
      expect(io.errLines).toEqual([
        'the Flutter SDK is not installed — run `fsx install` first.',
      ]);
    } finally {
      if (previous === undefined) delete process.env.FSX_HOME;
      else process.env.FSX_HOME = previous;
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe('buildCommands', () => {
  test('runs the install command it was given', async () => {
    const io = captureIo();
    let installs = 0;

    const code = await runCli(
      ['install'],
      io,
      buildCommands(() => {
        installs += 1;
        return Promise.resolve();
      }),
    );

    expect(code).toBe(0);
    expect(installs).toBe(1);
  });

  test('hands init the directory and the real dependency set', async () => {
    const io = captureIo();
    const calls: string[] = [];
    const deps = defaultInitDeps();

    const code = await runCli(
      ['init', 'my-app'],
      io,
      buildCommands(
        () => Promise.resolve(),
        (directory, given) => {
          calls.push(directory);
          expect(given).toBe(deps);
          return Promise.resolve();
        },
        () => deps,
      ),
    );

    expect(code).toBe(0);
    expect(calls).toEqual(['my-app']);
  });
});
