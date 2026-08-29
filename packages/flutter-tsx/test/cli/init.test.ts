import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { mainDart } from '@src/build/project';
import {
  defaultInitDeps,
  type InitDeps,
  packageNameFrom,
  runInitCommand,
} from '@src/cli/init';

const deps = (
  overrides: Partial<InitDeps> = {},
): {
  deps: InitDeps;
  written: Map<string, string>;
  ran: string[][];
  removed: string[];
} => {
  const written = new Map<string, string>();
  const ran: string[][] = [];
  const removed: string[] = [];
  return {
    written,
    ran,
    removed,
    deps: {
      removeFile: (path): Promise<void> => {
        removed.push(path);
        return Promise.resolve();
      },
      sdkInstalled: () => Promise.resolve(true),
      pathExists: () => Promise.resolve(false),
      writeFile: (path, contents): Promise<void> => {
        written.set(path, contents);
        return Promise.resolve();
      },
      runFlutter: (args, cwd): Promise<number> => {
        ran.push([...args, `(in ${cwd})`]);
        return Promise.resolve(0);
      },
      out: () => undefined,
      ...overrides,
    },
  };
};

describe('packageNameFrom', () => {
  test('turns a directory name into a Dart package name', () => {
    expect(packageNameFrom('my-app')).toBe('my_app');
    expect(packageNameFrom('My App')).toBe('my_app');
    expect(packageNameFrom('weather.station')).toBe('weather_station');
    expect(packageNameFrom('2cool')).toBe('app_2cool');
  });
});

describe('runInitCommand', () => {
  test('scaffolds the project and creates the Flutter host app', async () => {
    const { deps: injected, written, ran } = deps();

    await runInitCommand('demo-app', injected);

    expect([...written.keys()].sort()).toEqual([
      'demo-app/.gitignore',
      'demo-app/fsx.config.ts',
      'demo-app/lib/main.dart',
      'demo-app/package.json',
      'demo-app/src/App.tsx',
      'demo-app/tsconfig.json',
    ]);
    expect(written.get('demo-app/fsx.config.ts')).toContain("name: 'demo_app'");
    // The host app is created in place, for the platform the config names.
    expect(ran).toEqual([
      [
        'create',
        '--platforms',
        'web',
        '--project-name',
        'demo_app',
        '--org',
        'dev.fluttertsx',
        '.',
        '(in demo-app)',
      ],
    ]);
  });

  test('refuses to write into a directory that already has a project', () => {
    const { deps: injected } = deps({
      pathExists: () => Promise.resolve(true),
    });

    expect(runInitCommand('demo-app', injected)).rejects.toThrow(
      new Error(
        'demo-app/package.json already exists — run fsx init in an empty ' +
          'directory.',
      ),
    );
  });

  test('says what to do when the SDK is missing', () => {
    const { deps: injected } = deps({
      sdkInstalled: () => Promise.resolve(false),
    });

    expect(runInitCommand('demo-app', injected)).rejects.toThrow(
      new Error('the Flutter SDK is not installed — run `fsx install` first.'),
    );
  });

  test('surfaces a failing flutter create rather than leaving a half project', () => {
    const { deps: injected } = deps({ runFlutter: () => Promise.resolve(1) });

    expect(runInitCommand('demo-app', injected)).rejects.toThrow(
      new Error('flutter create failed (exit 1) in demo-app.'),
    );
  });
});

describe('packageNameFrom — paths', () => {
  test('uses the target directory, never the path leading to it', () => {
    expect(packageNameFrom('/var/folders/t/fsx-init-cay/demo-app')).toBe(
      'demo_app',
    );
  });

  test('falls back to a valid name when the directory has no usable name', () => {
    expect(packageNameFrom('/')).toBe('app');
  });
});

describe('defaultInitDeps', () => {
  const withFsxHome = async (
    body: (home: string) => Promise<void>,
  ): Promise<void> => {
    const home = await mkdtemp(join(tmpdir(), 'fsx-deps-'));
    const previous = process.env.FSX_HOME;
    process.env.FSX_HOME = home;
    try {
      await body(home);
    } finally {
      if (previous === undefined) delete process.env.FSX_HOME;
      else process.env.FSX_HOME = previous;
      await rm(home, { recursive: true, force: true });
    }
  };

  test('wires every dependency to the real filesystem and SDK', async () => {
    await withFsxHome(async (home) => {
      const flutterBin = join(home, 'flutter', 'bin', 'flutter');
      expect(await defaultInitDeps().sdkInstalled()).toBe(false);

      // A stub standing in for the real SDK binary: enough to prove the
      // dependency shells out to it and reports its exit code.
      await Bun.write(flutterBin, '#!/bin/sh\nexit 7\n');
      await chmod(flutterBin, 0o755);

      const wired = defaultInitDeps();
      expect(await wired.sdkInstalled()).toBe(true);

      const target = join(home, 'nested', 'note.txt');
      expect(await wired.pathExists(target)).toBe(false);
      await wired.writeFile(target, 'written');
      expect(await wired.pathExists(target)).toBe(true);
      expect(await Bun.file(target).text()).toBe('written');

      expect(await wired.runFlutter(['--version'], home)).toBe(7);

      const lines: string[] = [];
      const write = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk: string): boolean => {
        lines.push(chunk);
        return true;
      };
      try {
        wired.out('hello');
      } finally {
        process.stdout.write = write;
      }
      expect(lines).toEqual(['hello\n']);
    });
  });
});

describe('runInitCommand — the entry point', () => {
  test('replaces the template main.dart and drops its widget test', async () => {
    const { deps: initDeps, written, removed } = deps();

    await runInitCommand('/app', initDeps);

    // `flutter create` writes a counter-app main.dart and a test for it;
    // neither belongs to a Flutter.tsx project.
    expect(written.get('/app/lib/main.dart')).toBe(
      mainDart({ name: 'app', rootImport: 'app.dart' }),
    );
    expect(removed).toEqual(['/app/test/widget_test.dart']);
  });
});
