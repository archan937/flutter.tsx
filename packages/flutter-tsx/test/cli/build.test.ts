import { describe, expect, test } from 'bun:test';

import {
  artifactPath,
  type BuildDeps,
  buildSubcommand,
  parseBuildArgs,
  runBuildCommand,
} from '@src/cli/build';
import type { AppConfig, AppTarget } from '@src/runtime/config';

describe('buildSubcommand', () => {
  test('maps every target to the flutter build it runs', () => {
    expect(buildSubcommand('web')).toBe('web');
    expect(buildSubcommand('ios')).toBe('ipa');
    expect(buildSubcommand('android')).toBe('appbundle');
    expect(buildSubcommand('macos')).toBe('macos');
    expect(buildSubcommand('windows')).toBe('windows');
    expect(buildSubcommand('linux')).toBe('linux');
  });
});

describe('artifactPath', () => {
  test('names where each target leaves its build', () => {
    expect(artifactPath('web')).toBe('build/web');
    expect(artifactPath('android')).toBe(
      'build/app/outputs/bundle/release/app-release.aab',
    );
    expect(artifactPath('macos')).toBe('build/macos/Build/Products/Release');
  });
});

describe('parseBuildArgs', () => {
  test('reads --target', () => {
    expect(parseBuildArgs(['--target=macos'])).toEqual({
      target: 'macos',
      codesign: true,
    });
  });

  test('is null when the flag is absent, so the config decides', () => {
    expect(parseBuildArgs([])).toEqual({ target: null, codesign: true });
  });

  test('reads --no-codesign', () => {
    expect(parseBuildArgs(['--target=ios', '--no-codesign'])).toEqual({
      target: 'ios',
      codesign: false,
    });
  });

  test('reports an unknown target', () => {
    expect(() => parseBuildArgs(['--target=toaster'])).toThrow(
      'unknown target `toaster`: one of web, ios, android, macos, windows, linux.',
    );
  });

  test('reports an argument that is not understood', () => {
    expect(() => parseBuildArgs(['--verbose'])).toThrow(
      'unexpected argument `--verbose`: fsx build takes --target=<platform> ' +
        'and --no-codesign.',
    );
  });
});

const CONFIG: AppConfig = {
  name: 'demo_app',
  bundleId: 'dev.fluttertsx.demo',
  target: 'web',
};

interface Harness {
  deps: BuildDeps;
  commands: string[][];
  lines: string[];
  built: AppTarget[];
}

const harness = (overrides: Partial<BuildDeps> = {}): Harness => {
  const commands: string[][] = [];
  const lines: string[] = [];
  const built: AppTarget[] = [];

  return {
    commands,
    lines,
    built,
    deps: {
      loadConfig: () => Promise.resolve({ ...CONFIG }),
      build: (_projectDir, config): Promise<string[]> => {
        built.push(config.target);
        return Promise.resolve(['app.dart']);
      },
      runFlutter: (args, cwd): Promise<number> => {
        commands.push([...args, `(in ${cwd})`]);
        return Promise.resolve(0);
      },
      pathExists: (): Promise<boolean> => Promise.resolve(true),
      out: (line): void => {
        lines.push(line);
      },
      ...overrides,
    },
  };
};

describe('runBuildCommand', () => {
  test('compiles the project, then builds the configured target', async () => {
    const context = harness();

    await runBuildCommand('/app', [], context.deps);

    expect(context.built).toEqual(['web']);
    expect(context.commands).toEqual([
      ['build', 'web', '--release', '(in /app)'],
    ]);
    expect(context.lines).toEqual([
      'Building demo_app for web…',
      'Built build/web',
    ]);
  });

  test('a --target flag overrides the configured one', async () => {
    const context = harness();

    await runBuildCommand('/app', ['--target=macos'], context.deps);

    expect(context.built).toEqual(['macos']);
    expect(context.commands).toEqual([
      ['config', '--enable-macos-desktop', '(in /app)'],
      ['build', 'macos', '--release', '(in /app)'],
    ]);
  });

  test('scaffolds a platform the project has never built for', async () => {
    const context = harness({
      pathExists: (path): Promise<boolean> =>
        Promise.resolve(!path.endsWith('/macos')),
    });

    await runBuildCommand('/app', ['--target=macos'], context.deps);

    expect(context.commands).toEqual([
      ['config', '--enable-macos-desktop', '(in /app)'],
      ['create', '--platforms', 'macos', '.', '(in /app)'],
      ['build', 'macos', '--release', '(in /app)'],
    ]);
  });

  test('web needs no desktop switch and no platform folder', async () => {
    const context = harness({
      pathExists: (): Promise<boolean> => Promise.resolve(false),
    });

    await runBuildCommand('/app', ['--target=web'], context.deps);

    expect(context.commands).toEqual([
      ['build', 'web', '--release', '(in /app)'],
    ]);
  });

  test('reports a build that failed', () => {
    const context = harness({
      runFlutter: (args): Promise<number> =>
        Promise.resolve(args[0] === 'build' ? 1 : 0),
    });

    expect(runBuildCommand('/app', [], context.deps)).rejects.toThrow(
      '`flutter build web --release` failed (exit 1).',
    );
  });

  test('reports a platform that could not be scaffolded', () => {
    const context = harness({
      pathExists: (): Promise<boolean> => Promise.resolve(false),
      runFlutter: (args): Promise<number> =>
        Promise.resolve(args[0] === 'create' ? 2 : 0),
    });

    expect(
      runBuildCommand('/app', ['--target=linux'], context.deps),
    ).rejects.toThrow('`flutter create --platforms linux .` failed (exit 2).');
  });
});

describe('runBuildCommand — an iOS build without an Apple account', () => {
  test('builds the unsigned app rather than a signed archive', async () => {
    const context = harness({
      loadConfig: () => Promise.resolve({ ...CONFIG, target: 'ios' }),
    });

    await runBuildCommand('/app', ['--no-codesign'], context.deps);

    // `flutter build ipa` needs a provisioning profile; the `.app` is what a
    // machine without one can produce, and what a simulator runs.
    expect(context.commands).toContainEqual([
      'build',
      'ios',
      '--release',
      '--no-codesign',
      '(in /app)',
    ]);
    expect(context.lines).toContain('Built build/ios/iphoneos');
  });

  test('refuses the flag where nothing is signed anyway', () => {
    const context = harness({
      loadConfig: () => Promise.resolve({ ...CONFIG, target: 'macos' }),
    });

    expect(
      runBuildCommand('/app', ['--no-codesign'], context.deps),
    ).rejects.toThrow(
      '--no-codesign is an iOS option; macos builds are not signed.',
    );
  });
});
