import { describe, expect, test } from 'bun:test';

import { type PluginSyncDeps, syncProjectPlugins } from '@src/plugins/sync';

const API = (packageName: string, version: string): string =>
  JSON.stringify({
    package: packageName,
    version,
    classes: [],
    enums: [],
    functions: [],
    permissions: {
      android: {
        manifestSource: null,
        permissions: [],
        exampleSource: null,
        querySchemes: [],
      },
      ios: {
        exampleSource: null,
        usageDescriptionKeys: [],
        querySchemes: [],
      },
    },
  });

const LOCK = `packages:
  url_launcher:
    dependency: "direct main"
    source: hosted
    version: "6.3.2"
`;

interface Harness {
  deps: PluginSyncDeps;
  files: Map<string, string>;
  commands: string[][];
  extracted: string[];
  lines: string[];
  removed: string[];
}

const harness = (
  files: Record<string, string>,
  overrides: Partial<PluginSyncDeps> = {},
): Harness => {
  const store = new Map(Object.entries(files));
  const commands: string[][] = [];
  const extracted: string[] = [];
  const lines: string[] = [];
  const removed: string[] = [];

  return {
    files: store,
    commands,
    extracted,
    lines,
    removed,
    deps: {
      readFile: (path): Promise<string | null> =>
        Promise.resolve(store.get(path) ?? null),
      writeFile: (path, contents): Promise<void> => {
        store.set(path, contents);
        return Promise.resolve();
      },
      removeFile: (path): Promise<void> => {
        removed.push(path);
        store.delete(path);
        return Promise.resolve();
      },
      pathExists: (path): Promise<boolean> => Promise.resolve(store.has(path)),
      runFlutter: (args, cwd): Promise<number> => {
        commands.push([...args, `(in ${cwd})`]);
        return Promise.resolve(0);
      },
      extractPlugin: (packageName, _projectDir, outPath): Promise<number> => {
        extracted.push(packageName);
        store.set(outPath, API(packageName, '6.3.2'));
        return Promise.resolve(0);
      },
      cacheDir: '/cache/plugins',
      out: (line): void => {
        lines.push(line);
      },
      ...overrides,
    },
  };
};

const manifest = (plugins: Record<string, string>): string =>
  JSON.stringify({ name: 'demo', plugins });

describe('syncProjectPlugins', () => {
  test('adds a newly declared plugin and writes its typings', async () => {
    const { deps, files, commands, extracted, lines } = harness({
      '/app/package.json': manifest({ url_launcher: '^6.3.0' }),
      '/app/pubspec.lock': LOCK,
    });

    await syncProjectPlugins('/app', deps);

    expect(commands).toEqual([
      ['pub', 'add', 'url_launcher@^6.3.0', '(in /app)'],
    ]);
    expect(extracted).toEqual(['url_launcher']);
    expect(files.get('/app/.fsx/types/url_launcher.d.ts')).toContain(
      "declare module 'plugin:url_launcher'",
    );
    // The compiler reads this extraction when it lowers `plugin:` calls.
    expect(
      JSON.parse(files.get('/app/.fsx/api/url_launcher.json') ?? ''),
    ).toEqual(JSON.parse(API('url_launcher', '6.3.2')));
    expect(JSON.parse(files.get('/app/.fsx/plugins.json') ?? '')).toEqual({
      url_launcher: '^6.3.0',
    });
    expect(lines).toEqual([
      'Adding 1 plugin: url_launcher@^6.3.0',
      'Generated types for url_launcher 6.3.2',
    ]);
  });

  test('reuses a cached extraction for a version already seen', async () => {
    const { deps, extracted, lines } = harness({
      '/app/package.json': manifest({ url_launcher: '^6.3.0' }),
      '/app/pubspec.lock': LOCK,
      '/cache/plugins/url_launcher@6.3.2.json': API('url_launcher', '6.3.2'),
    });

    await syncProjectPlugins('/app', deps);

    expect(extracted).toEqual([]);
    expect(lines).toEqual([
      'Adding 1 plugin: url_launcher@^6.3.0',
      'Generated types for url_launcher 6.3.2',
    ]);
  });

  test('removes a plugin that is no longer declared, with its typings', async () => {
    const { deps, commands, removed, files } = harness({
      '/app/package.json': manifest({}),
      '/app/pubspec.lock': 'packages: {}\n',
      '/app/.fsx/plugins.json': JSON.stringify({ url_launcher: '^6.3.0' }),
      '/app/.fsx/types/url_launcher.d.ts': 'stale',
    });

    await syncProjectPlugins('/app', deps);

    expect(commands).toEqual([['pub', 'remove', 'url_launcher', '(in /app)']]);
    expect(removed).toEqual(['/app/.fsx/types/url_launcher.d.ts']);
    expect(JSON.parse(files.get('/app/.fsx/plugins.json') ?? '')).toEqual({});
  });

  test('writes no state into a project that declares no plugins', async () => {
    const { deps, files, lines } = harness({
      '/app/package.json': manifest({}),
    });

    await syncProjectPlugins('/app', deps);

    expect(files.has('/app/.fsx/plugins.json')).toBe(false);
    expect(lines).toEqual(['Plugins are up to date.']);
  });

  test('does nothing when the declared plugins are already installed', async () => {
    const { deps, commands, lines } = harness({
      '/app/package.json': manifest({ url_launcher: '^6.3.0' }),
      '/app/pubspec.lock': LOCK,
      '/app/.fsx/plugins.json': JSON.stringify({ url_launcher: '^6.3.0' }),
      '/app/.fsx/types/url_launcher.d.ts': 'current',
      '/cache/plugins/url_launcher@6.3.2.json': API('url_launcher', '6.3.2'),
    });

    await syncProjectPlugins('/app', deps);

    expect(commands).toEqual([]);
    expect(lines).toEqual(['Plugins are up to date.']);
  });

  test('regenerates typings when they are missing for a declared plugin', async () => {
    const { deps, files, commands } = harness({
      '/app/package.json': manifest({ url_launcher: '^6.3.0' }),
      '/app/pubspec.lock': LOCK,
      '/app/.fsx/plugins.json': JSON.stringify({ url_launcher: '^6.3.0' }),
      '/cache/plugins/url_launcher@6.3.2.json': API('url_launcher', '6.3.2'),
    });

    await syncProjectPlugins('/app', deps);

    expect(commands).toEqual([]);
    expect(files.get('/app/.fsx/types/url_launcher.d.ts')).toContain(
      "declare module 'plugin:url_launcher'",
    );
  });

  test('reports a project without a manifest', () => {
    const { deps } = harness({});

    expect(syncProjectPlugins('/app', deps)).rejects.toThrow(
      '/app/package.json does not exist — run `fsx init` first.',
    );
  });

  test('reports a failing pub command instead of generating stale types', () => {
    const { deps } = harness(
      {
        '/app/package.json': manifest({ url_launcher: '^6.3.0' }),
        '/app/pubspec.lock': LOCK,
      },
      { runFlutter: (): Promise<number> => Promise.resolve(66) },
    );

    expect(syncProjectPlugins('/app', deps)).rejects.toThrow(
      '`flutter pub add url_launcher@^6.3.0` failed (exit 66).',
    );
  });

  test('reports a plugin pub never resolved', () => {
    const { deps } = harness({
      '/app/package.json': manifest({ camera: '^0.12.0' }),
      '/app/pubspec.lock': LOCK,
    });

    expect(syncProjectPlugins('/app', deps)).rejects.toThrow(
      'camera is not in /app/pubspec.lock — `flutter pub add` did not resolve it.',
    );
  });

  test('reports a failing extraction', () => {
    const { deps } = harness(
      {
        '/app/package.json': manifest({ url_launcher: '^6.3.0' }),
        '/app/pubspec.lock': LOCK,
      },
      { extractPlugin: (): Promise<number> => Promise.resolve(3) },
    );

    expect(syncProjectPlugins('/app', deps)).rejects.toThrow(
      'extracting the url_launcher 6.3.2 API failed (exit 3).',
    );
  });

  test('reports an extractor that succeeded without writing anything', () => {
    const { deps } = harness(
      {
        '/app/package.json': manifest({ url_launcher: '^6.3.0' }),
        '/app/pubspec.lock': LOCK,
      },
      { extractPlugin: (): Promise<number> => Promise.resolve(0) },
    );

    expect(syncProjectPlugins('/app', deps)).rejects.toThrow(
      '/cache/plugins/url_launcher@6.3.2.json was not written by the extractor.',
    );
  });

  test('reports a missing pubspec.lock', () => {
    const { deps } = harness({
      '/app/package.json': manifest({ url_launcher: '^6.3.0' }),
    });

    expect(syncProjectPlugins('/app', deps)).rejects.toThrow(
      '/app/pubspec.lock does not exist — `flutter pub add` did not write it.',
    );
  });
});
