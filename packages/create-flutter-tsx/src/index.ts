import {
  defaultInitDeps,
  runCreateCommand,
  runInitCommand,
} from 'flutter-tsx/cli';

export const CREATE_FLUTTER_TSX_VERSION = '1.0.0-alpha.0';

/** Where the scaffolder writes; separated so tests can capture both streams. */
export interface CreateIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

export const defaultCreateIo = (): CreateIo => ({
  out: (line: string): void => {
    process.stdout.write(`${line}\n`);
  },
  err: (line: string): void => {
    process.stderr.write(`${line}\n`);
  },
});

/**
 * `npm create flutter-tsx@latest my-app`. The scaffolding is `fsx init`, so a
 * project created here and one created by the CLI are the same project.
 */
export const runCreate = async (
  argv: string[],
  io: CreateIo = defaultCreateIo(),
): Promise<number> => {
  try {
    await runCreateCommand(argv, {
      init: (directory) => runInitCommand(directory, defaultInitDeps()),
      out: io.out,
    });
    return 0;
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
};
