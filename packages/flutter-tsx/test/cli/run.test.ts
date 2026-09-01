import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  defaultInitDeps,
  type InitDeps,
  type InitOptions,
} from '@src/cli/init';
import {
  buildCommands,
  type CliIo,
  type CommandRunners,
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
  '                 --template=<name>  start from an example app',
  '                 (desktop, mobile, tray, web)',
  '                 --target=<platform>  the platform to build for',
  '  dev            Compile, run and hot reload the app here',
  '  build          Compile and build the app for release',
  '  doctor         Check that this project is ready to build',
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

describe('runCli — init flags', () => {
  const capture = (): {
    io: CapturedIo;
    seen: { directory: string; options: InitOptions }[];
    commands: CommandRunners;
  } => {
    const seen: { directory: string; options: InitOptions }[] = [];
    return {
      io: captureIo(),
      seen,
      commands: {
        init: (directory, _deps, options): Promise<void> => {
          seen.push({ directory, options: options ?? {} });
          return Promise.resolve();
        },
        initDeps: () => ({}) as unknown as InitDeps,
      },
    };
  };

  test('--template and --target reach the command', async () => {
    const { io, seen, commands } = capture();

    const code = await runCli(
      ['init', 'demo-app', '--template=tray', '--target=linux'],
      io,
      buildCommands(commands),
    );

    expect(code).toBe(0);
    expect(seen).toEqual([
      { directory: 'demo-app', options: { template: 'tray', target: 'linux' } },
    ]);
  });

  test('a flag may be written with a space', async () => {
    const { io, seen, commands } = capture();

    await runCli(
      ['init', 'demo-app', '--template', 'web'],
      io,
      buildCommands(commands),
    );

    expect(seen).toEqual([
      { directory: 'demo-app', options: { template: 'web' } },
    ]);
  });

  test('a flag with no value at all is reported', async () => {
    for (const args of [
      ['init', 'demo-app', '--template'],
      ['init', 'demo-app', '--target='],
    ]) {
      const io = captureIo();

      expect(await runCli(args, io)).toBe(1);
      expect(io.errLines).toEqual([
        `${args[2]?.split('=')[0] ?? ''} needs a value: ` +
          `\`${args[2]?.split('=')[0] ?? ''}=web\`.`,
      ]);
    }
  });

  test('an unknown template is reported with the ones that exist', async () => {
    const io = captureIo();

    const code = await runCli(['init', 'demo-app', '--template=phone'], io);

    expect(code).toBe(1);
    expect(io.errLines).toEqual([
      'unknown template `phone` — available: desktop, mobile, tray, web.',
    ]);
  });

  test('an unknown target is reported with the ones that exist', async () => {
    const io = captureIo();

    const code = await runCli(['init', 'demo-app', '--target=toaster'], io);

    expect(code).toBe(1);
    expect(io.errLines).toEqual([
      'unknown target `toaster` — available: android, ios, linux, macos, ' +
        'web, windows.',
    ]);
  });

  test('an unknown flag is reported rather than ignored', async () => {
    const io = captureIo();

    const code = await runCli(['init', 'demo-app', '--fast'], io);

    expect(code).toBe(1);
    expect(io.errLines).toEqual([
      'unknown option `--fast` for fsx init: use --template or --target.',
    ]);
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
      buildCommands({
        install: () => {
          installs += 1;
          return Promise.resolve();
        },
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
      buildCommands({
        install: () => Promise.resolve(),
        init: (directory, given) => {
          calls.push(directory);
          expect(given).toBe(deps);
          return Promise.resolve();
        },
        initDeps: () => deps,
      }),
    );

    expect(code).toBe(0);
    expect(calls).toEqual(['my-app']);
  });
});

describe('buildCommands — dev', () => {
  test('runs dev in the working directory', async () => {
    const io = captureIo();
    const directories: string[] = [];

    const code = await runCli(
      ['dev'],
      io,
      buildCommands({
        dev: (projectDir) => {
          directories.push(projectDir);
          return Promise.resolve();
        },
      }),
    );

    expect(code).toBe(0);
    expect(directories).toEqual([process.cwd()]);
  });
});

describe('buildCommands — build', () => {
  test('runs build in the working directory with its arguments', async () => {
    const io = captureIo();
    const calls: [string, string[]][] = [];

    const code = await runCli(
      ['build', '--target=macos'],
      io,
      buildCommands({
        build: (projectDir, args) => {
          calls.push([projectDir, args]);
          return Promise.resolve();
        },
      }),
    );

    expect(code).toBe(0);
    expect(calls).toEqual([[process.cwd(), ['--target=macos']]]);
  });
});

describe('buildCommands — doctor', () => {
  test('runs doctor in the working directory', async () => {
    const io = captureIo();
    const directories: string[] = [];

    const code = await runCli(
      ['doctor'],
      io,
      buildCommands({
        doctor: (projectDir) => {
          directories.push(projectDir);
          return Promise.resolve();
        },
      }),
    );

    expect(code).toBe(0);
    expect(directories).toEqual([process.cwd()]);
  });
});
