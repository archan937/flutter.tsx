import { describe, expect, test } from 'bun:test';

import { type CliIo, defaultCliIo, formatError, runCli } from '@src/cli/run';

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

describe('runCli', () => {
  test('prints usage and fails when no command is given', async () => {
    const io = captureIo();

    expect(await runCli([], io, {})).toBe(1);
    expect(io.errLines.join('\n')).toContain('Usage: fsx <command>');
  });

  test('rejects unknown commands', async () => {
    const io = captureIo();

    expect(await runCli(['frobnicate'], io, {})).toBe(1);
    expect(io.errLines.join('\n')).toContain('Unknown command: frobnicate');
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
