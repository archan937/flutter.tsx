import { runInstallCommand } from './install';

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

export type CommandRunner = () => Promise<void>;

export const defaultCliIo: CliIo = {
  out: (line) => {
    process.stdout.write(`${line}\n`);
  },
  err: (line) => {
    process.stderr.write(`${line}\n`);
  },
};

const defaultCommands: Record<string, CommandRunner> = {
  install: runInstallCommand,
};

const USAGE = [
  'Usage: fsx <command>',
  '',
  'Commands:',
  '  install   Download the pinned Flutter SDK to ~/.fsx/flutter',
].join('\n');

export const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const runCli = async (
  argv: string[],
  io: CliIo = defaultCliIo,
  commands: Record<string, CommandRunner> = defaultCommands,
): Promise<number> => {
  const [command] = argv;
  if (command === undefined) {
    io.err(USAGE);
    return 1;
  }
  const runner = commands[command];
  if (runner === undefined) {
    io.err(`Unknown command: ${command}\n\n${USAGE}`);
    return 1;
  }
  try {
    await runner();
    return 0;
  } catch (error) {
    io.err(formatError(error));
    return 1;
  }
};
