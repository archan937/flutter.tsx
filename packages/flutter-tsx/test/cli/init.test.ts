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
import type { Template } from '@src/cli/templates';

const deps = (
  overrides: Partial<InitDeps> = {},
): {
  deps: InitDeps;
  written: Map<string, string>;
  ran: string[][];
  removed: string[];
  synced: string[];
} => {
  const written = new Map<string, string>();
  const ran: string[][] = [];
  const removed: string[] = [];
  const synced: string[] = [];
  return {
    written,
    ran,
    removed,
    synced,
    deps: {
      removeFile: (path): Promise<void> => {
        removed.push(path);
        return Promise.resolve();
      },
      sdkInstalled: () => Promise.resolve(true),
      syncPlugins: (projectDir): Promise<void> => {
        synced.push(projectDir);
        return Promise.resolve();
      },
      loadTemplate: (name): Promise<Template> =>
        Promise.resolve({
          name,
          target: 'macos',
          blurb: 'a probe',
          plugins: { tray_manager: '^0.5.3' },
          sources: [{ path: 'src/App.tsx', contents: '// the template app\n' }],
        }),
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
      'demo-app/src/components/Greeting.tsx',
      'demo-app/src/helpers/format.tsx',
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

      // The wired-up template loader and plugin sync are the real ones: the
      // loader reads this package's templates, and the sync refuses a
      // directory that is not a project.
      expect((await wired.loadTemplate('tray')).target).toBe('macos');
      expect(wired.syncPlugins(join(home, 'not-a-project'))).rejects.toThrow(
        /package.json does not exist/,
      );

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

describe('runInitCommand — a template that brings plugins', () => {
  test('installs what the template declares, so the project builds as it is', async () => {
    const context = deps();

    await runInitCommand('/app', context.deps, { template: 'tray' });

    // The manifest declares them and the sync installs them; a project that
    // scaffolded without them would not resolve its own imports.
    expect(context.written.get('/app/package.json')).toContain(
      '"tray_manager": "^0.5.3"',
    );
    expect(context.synced).toEqual(['/app']);
  });

  test('the starter needs no plugins, so nothing is installed', async () => {
    const context = deps();

    await runInitCommand('/app', context.deps);

    expect(context.synced).toEqual([]);
  });
});

describe('runInitCommand — a project that is not for the web', () => {
  test('scaffolds for the target it was asked for', async () => {
    const context = deps();

    await runInitCommand('/app', context.deps, { target: 'macos' });

    // The config says what the project is, and `flutter create` is asked for
    // that platform rather than web.
    expect(context.written.get('/app/fsx.config.ts')).toContain(
      "target: 'macos',",
    );
    expect(context.ran).toContainEqual([
      'create',
      '--platforms',
      'macos',
      '--project-name',
      'app',
      '--org',
      'dev.fluttertsx',
      '.',
      '(in /app)',
    ]);
  });

  test('is a web project when no target is given', async () => {
    const context = deps();

    await runInitCommand('/app', context.deps);

    expect(context.written.get('/app/fsx.config.ts')).toContain(
      "target: 'web',",
    );
  });
});
