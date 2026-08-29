import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  type DevDeps,
  deviceFor,
  loadAppConfig,
  runDevCommand,
} from '@src/cli/dev';

describe('deviceFor', () => {
  test('maps every target to the device flutter runs on', () => {
    expect(deviceFor('web')).toBe('chrome');
    expect(deviceFor('ios')).toBe('ios');
    expect(deviceFor('android')).toBe('android');
    expect(deviceFor('macos')).toBe('macos');
    expect(deviceFor('windows')).toBe('windows');
    expect(deviceFor('linux')).toBe('linux');
  });
});

describe('loadAppConfig', () => {
  const withConfig = async (
    contents: string | null,
    body: (dir: string) => Promise<void> | void,
  ): Promise<void> => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-config-'));
    if (contents !== null) {
      await Bun.write(join(dir, 'fsx.config.ts'), contents);
    }
    try {
      await body(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };

  test('reads the default export', async () => {
    await withConfig(
      `export default {
  name: 'demo_app',
  bundleId: 'dev.fluttertsx.demo',
  target: 'web',
};
`,
      async (dir) => {
        expect(await loadAppConfig(dir)).toEqual({
          name: 'demo_app',
          bundleId: 'dev.fluttertsx.demo',
          target: 'web',
        });
      },
    );
  });

  test('reports a missing config', async () => {
    await withConfig(null, (dir) => {
      expect(loadAppConfig(dir)).rejects.toThrow(
        `${dir}/fsx.config.ts does not exist — run \`fsx init\` first.`,
      );
    });
  });

  test('reports a config that exports no app', async () => {
    await withConfig('export const other = 1;\n', (dir) => {
      expect(loadAppConfig(dir)).rejects.toThrow(
        `${dir}/fsx.config.ts must export an app config as its default export.`,
      );
    });
  });

  test('reports an unknown target', async () => {
    await withConfig(
      `export default { name: 'a', bundleId: 'b', target: 'toaster' };\n`,
      (dir) => {
        expect(loadAppConfig(dir)).rejects.toThrow(
          `${dir}/fsx.config.ts: target must be one of web, ios, android, macos, windows, linux.`,
        );
      },
    );
  });

  test('reports a missing name', async () => {
    await withConfig(
      `export default { bundleId: 'b', target: 'web' };\n`,
      (dir) => {
        expect(loadAppConfig(dir)).rejects.toThrow(
          `${dir}/fsx.config.ts: name must be a string.`,
        );
      },
    );
  });

  test('reports a missing bundleId', async () => {
    await withConfig(
      `export default { name: 'a', target: 'web' };\n`,
      (dir) => {
        expect(loadAppConfig(dir)).rejects.toThrow(
          `${dir}/fsx.config.ts: bundleId must be a string.`,
        );
      },
    );
  });
});

interface Harness {
  deps: DevDeps;
  lines: string[];
  builds: number;
  reloads: number;
  commands: string[][];
}

const CONFIG = {
  name: 'demo_app',
  bundleId: 'dev.fluttertsx.demo',
  target: 'web',
} as const;

const harness = (overrides: Partial<DevDeps> = {}): Harness => {
  const lines: string[] = [];
  const commands: string[][] = [];
  const state = { builds: 0, reloads: 0 };
  let onChange: (path: string) => void = () => undefined;

  const deps: DevDeps = {
    loadConfig: () => Promise.resolve({ ...CONFIG }),
    build: (): Promise<string[]> => {
      state.builds += 1;
      return Promise.resolve(['app.dart']);
    },
    startFlutter: (args, cwd) => {
      commands.push([...args, `(in ${cwd})`]);
      return {
        reload: (): void => {
          state.reloads += 1;
        },
        stop: (): void => undefined,
        // Ends once the change that the test triggers has been handled.
        exited: Promise.resolve(0).then(async () => {
          onChange('/app/src/App.tsx');
          await Promise.resolve();
          return 0;
        }),
      };
    },
    watch: (_dir, handler) => {
      onChange = handler;
      return (): void => undefined;
    },
    out: (line): void => {
      lines.push(line);
    },
    ...overrides,
  };

  return {
    deps,
    lines,
    commands,
    get builds(): number {
      return state.builds;
    },
    get reloads(): number {
      return state.reloads;
    },
  };
};

describe('runDevCommand', () => {
  test('builds, runs flutter on the configured device, and hot reloads on change', async () => {
    const context = harness();

    const exitCode = await runDevCommand('/app', context.deps);

    expect(exitCode).toBe(0);
    expect(context.commands).toEqual([['run', '-d', 'chrome', '(in /app)']]);
    expect(context.builds).toBe(2);
    expect(context.reloads).toBe(1);
    expect(context.lines).toEqual([
      'Building demo_app…',
      'Running on chrome — edit src/ to hot reload.',
      'Rebuilt src/App.tsx',
    ]);
  });

  test('keeps running when a rebuild fails, reporting the error', async () => {
    let builds = 0;
    const context = harness({
      build: (): Promise<string[]> => {
        builds += 1;
        if (builds === 1) return Promise.resolve(['app.dart']);
        return Promise.reject(new Error('TSX0305: not compiled yet'));
      },
    });

    const exitCode = await runDevCommand('/app', context.deps);

    expect(exitCode).toBe(0);
    expect(context.reloads).toBe(0);
    expect(context.lines).toEqual([
      'Building demo_app…',
      'Running on chrome — edit src/ to hot reload.',
      'TSX0305: not compiled yet',
    ]);
  });

  test('reports the exit code flutter ended with', async () => {
    const context = harness({
      startFlutter: () => ({
        reload: (): void => undefined,
        stop: (): void => undefined,
        exited: Promise.resolve(3),
      }),
    });

    expect(await runDevCommand('/app', context.deps)).toBe(3);
  });
});
