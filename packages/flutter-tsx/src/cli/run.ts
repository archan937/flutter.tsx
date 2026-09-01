import { APP_TARGETS, type AppTarget, isAppTarget } from '../runtime/config';
import { defaultBuild } from './build-command';
import { defaultDev } from './dev-command';
import { defaultDoctor } from './doctor-command';
import { defaultInitDeps, type InitOptions, runInitCommand } from './init';
import { runInstallCommand } from './install';
import { TEMPLATE_NAMES } from './templates';

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
export interface CommandRunners {
  install?: typeof runInstallCommand;
  init?: typeof runInitCommand;
  initDeps?: typeof defaultInitDeps;
  dev?: (projectDir: string) => Promise<void>;
  build?: (projectDir: string, args: string[]) => Promise<void>;
  doctor?: (projectDir: string) => Promise<void>;
}

export const buildCommands = ({
  install = runInstallCommand,
  init = runInitCommand,
  initDeps = defaultInitDeps,
  dev = defaultDev,
  build = defaultBuild,
  doctor = defaultDoctor,
}: CommandRunners = {}): Record<string, CommandRunner> => ({
  doctor: () => doctor(process.cwd()),
  dev: () => dev(process.cwd()),
  build: (args) => build(process.cwd(), args),
  install: async (): Promise<void> => {
    await install();
  },
  init: async (args): Promise<void> => {
    const [directory] = args;
    if (directory === undefined || directory.startsWith('--')) {
      throw new Error('fsx init needs a directory: `fsx init my-app`.');
    }
    await init(directory, initDeps(), initOptions(args.slice(1)));
  },
});

const INIT_OPTIONS = ['--template', '--target'] as const;

/**
 * `--template=tray` / `--target linux`, in either spelling.
 *
 * An option this command does not have, or a value it does not accept, is
 * reported rather than ignored: a silently dropped flag scaffolds the wrong
 * project and looks like it worked.
 */
export const initOptions = (args: readonly string[]): InitOptions => {
  const options: { template?: string; target?: AppTarget } = {};
  const rest = [...args];
  while (rest.length > 0) {
    const argument = rest.shift() ?? '';
    const [flag, inlineValue] = argument.includes('=')
      ? [
          argument.slice(0, argument.indexOf('=')),
          argument.slice(argument.indexOf('=') + 1),
        ]
      : [argument, rest.shift()];
    if (!INIT_OPTIONS.includes(flag as (typeof INIT_OPTIONS)[number])) {
      throw new Error(
        `unknown option \`${flag}\` for fsx init: use --template or --target.`,
      );
    }
    if (inlineValue === undefined || inlineValue === '') {
      throw new Error(`${flag} needs a value: \`${flag}=web\`.`);
    }
    if (flag === '--template') {
      options.template = templateNamed(inlineValue);
    } else {
      options.target = targetNamed(inlineValue);
    }
  }
  return options;
};

const templateNamed = (value: string): string => {
  if (!TEMPLATE_NAMES.includes(value)) {
    throw new Error(
      `unknown template \`${value}\` — available: ${TEMPLATE_NAMES.join(', ')}.`,
    );
  }
  return value;
};

const targetNamed = (value: string): AppTarget => {
  if (!isAppTarget(value)) {
    throw new Error(
      `unknown target \`${value}\` — available: ${APP_TARGETS.join(', ')}.`,
    );
  }
  return value;
};

const defaultCommands = buildCommands();

const USAGE = [
  'Usage: fsx <command> [arguments]',
  '',
  'Commands:',
  '  install        Download the pinned Flutter SDK to ~/.fsx/flutter',
  '  init <dir>     Scaffold a new Flutter.tsx project',
  '                 --template=<name>  start from an example app',
  `                 (${TEMPLATE_NAMES.join(', ')})`,
  '                 --target=<platform>  the platform to build for',
  '  dev            Compile, run and hot reload the app here',
  '  build          Compile and build the app for release',
  '  doctor         Check that this project is ready to build',
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
