export interface CreateDeps {
  init: (directory: string) => Promise<void>;
  out: (line: string) => void;
}

const USAGE = 'usage: create-flutter-tsx <directory>';

/**
 * `npm create flutter-tsx@latest my-app`: scaffolds a project and says what to
 * run next. The scaffolding itself is `fsx init`, so both entry points make
 * exactly the same project.
 */
export const runCreateCommand = async (
  args: string[],
  deps: CreateDeps,
): Promise<void> => {
  const [directory, ...rest] = args;
  if (directory === undefined || rest.length > 0) {
    throw new Error(USAGE);
  }

  deps.out(`Creating ${directory}…`);
  await deps.init(directory);

  for (const line of [
    '',
    'Done. Next:',
    `  cd ${directory}`,
    '  bun install',
    '  fsx install',
    '  fsx dev',
  ]) {
    deps.out(line);
  }
};
