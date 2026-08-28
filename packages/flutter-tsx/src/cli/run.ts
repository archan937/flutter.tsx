import { defaultInitDeps, runInitCommand } from './init';
import { runInstallCommand } from './install';

export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

export type CommandRunner = (args: string[]) => Promise<void>;

export const defaultCliIo: CliIo = {
  out: (line) => {
    process.stdout.write(`${line}\n`);
  },
  err: (line) => {
    process.stderr.write(`${line}\n`);
  },
};

/**
 * The command table, with its runners injectable so the wiring itself can be
 * driven by tests without shelling out to the network or the Flutter SDK.
 */
export const buildCommands = (
  install: typeof runInstallCommand = runInstallCommand,
  init: typeof runInitCommand = runInitCommand,
  initDeps: typeof defaultInitDeps = defaultInitDeps,
): Record<string, CommandRunner> => ({
  install: async (): Promise<void> => {
    await install();
  },
  init: async (args): Promise<void> => {
    const [directory] = args;
    if (directory === undefined) {
      throw new Error('fsx init needs a directory: `fsx init my-app`.');
    }
    await init(directory, initDeps());
  },
});

const defaultCommands = buildCommands();

const USAGE = [
  'Usage: fsx <command> [arguments]',
  '',
  'Commands:',
  '  install        Download the pinned Flutter SDK to ~/.fsx/flutter',
  '  init <dir>     Scaffold a new Flutter.tsx project',
].join('\n');

export const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const runCli = async (
  argv: string[],
  io: CliIo = defaultCliIo,
  commands: Record<string, CommandRunner> = defaultCommands,
): Promise<number> => {
  const [command, ...args] = argv;
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
    await runner(args);
    return 0;
  } catch (error) {
    io.err(formatError(error));
    return 1;
  }
};
