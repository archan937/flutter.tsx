import { describe, expect, test } from 'bun:test';

import { type CreateDeps, runCreateCommand } from '@src/cli/create';

interface Harness {
  deps: CreateDeps;
  lines: string[];
  created: string[];
}

const harness = (overrides: Partial<CreateDeps> = {}): Harness => {
  const lines: string[] = [];
  const created: string[] = [];

  return {
    lines,
    created,
    deps: {
      init: (directory): Promise<void> => {
        created.push(directory);
        return Promise.resolve();
      },
      out: (line): void => {
        lines.push(line);
      },
      ...overrides,
    },
  };
};

describe('runCreateCommand', () => {
  test('scaffolds the named directory and says what to do next', async () => {
    const context = harness();

    await runCreateCommand(['my-app'], context.deps);

    expect(context.created).toEqual(['my-app']);
    expect(context.lines).toEqual([
      'Creating my-app…',
      '',
      'Done. Next:',
      '  cd my-app',
      '  bun install',
      '  fsx install',
      '  fsx dev',
    ]);
  });

  test('reports a missing directory name', () => {
    const context = harness();

    expect(runCreateCommand([], context.deps)).rejects.toThrow(
      'usage: create-flutter-tsx <directory>',
    );
  });

  test('reports more arguments than it understands', () => {
    const context = harness();

    expect(runCreateCommand(['a', 'b'], context.deps)).rejects.toThrow(
      'usage: create-flutter-tsx <directory>',
    );
  });
});
