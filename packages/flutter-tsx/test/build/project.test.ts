import { describe, expect, test } from 'bun:test';

import {
  type BuildDeps,
  buildProject,
  dartFileFor,
  GENERATED_ENTRY,
  mainDart,
} from '@src/build/project';

describe('dartFileFor', () => {
  test('converts a component file name to its Dart file name', () => {
    expect(dartFileFor('App.tsx')).toBe('app.dart');
    expect(dartFileFor('CameraScreen.tsx')).toBe('camera_screen.dart');
    expect(dartFileFor('AlbumView2.tsx')).toBe('album_view2.dart');
  });

  test('keeps runs of capitals together', () => {
    expect(dartFileFor('HTTPClient.tsx')).toBe('http_client.dart');
    expect(dartFileFor('APIKey.tsx')).toBe('api_key.dart');
  });

  test('preserves the directory a component lives in', () => {
    expect(dartFileFor('widgets/UserCard.tsx')).toBe('widgets/user_card.dart');
  });

  test('leaves an already lowercase name alone', () => {
    expect(dartFileFor('app.tsx')).toBe('app.dart');
  });
});

describe('mainDart', () => {
  test('hosts the root component in a titled MaterialApp', () => {
    expect(mainDart({ name: 'Demo App', rootImport: 'app.dart' })).toBe(
      `${GENERATED_ENTRY}
import 'package:flutter/material.dart';

import 'app.dart';

void main() {
  runApp(
    const MaterialApp(
      title: 'Demo App',
      home: Scaffold(body: SafeArea(child: App())),
    ),
  );
}
`,
    );
  });

  test('escapes a title containing a quote', () => {
    expect(mainDart({ name: "Paul's App", rootImport: 'app.dart' })).toContain(
      "title: 'Paul\\'s App',",
    );
  });
});

interface Harness {
  deps: BuildDeps;
  written: Map<string, string>;
}

const harness = (
  sources: Record<string, string>,
  overrides: Partial<BuildDeps> = {},
): Harness => {
  const written = new Map<string, string>();

  return {
    written,
    deps: {
      findComponents: (): Promise<string[]> =>
        Promise.resolve(Object.keys(sources).sort()),
      readFile: (path): Promise<string> => {
        const relative = path.replace('/app/src/', '');
        const source = sources[relative];
        if (source === undefined) throw new Error(`unexpected read: ${path}`);
        return Promise.resolve(source);
      },
      writeFile: (path, contents): Promise<void> => {
        written.set(path, contents);
        return Promise.resolve();
      },
      transpile: (input): Promise<string> =>
        Promise.resolve(`// dart for ${input.filePath}\n`),
      pathExists: (): Promise<boolean> => Promise.resolve(false),
      format: (): Promise<number> => Promise.resolve(0),
      ...overrides,
    },
  };
};

describe('buildProject', () => {
  test('writes one Dart file per component plus the entry point', async () => {
    const { deps, written } = harness({
      'App.tsx': 'export const App = () => <Text>hi</Text>;',
      'widgets/UserCard.tsx': 'export const UserCard = () => <Text>u</Text>;',
    });

    const built = await buildProject('/app', { name: 'Demo' }, deps);

    expect(built).toEqual(['app.dart', 'widgets/user_card.dart']);
    expect([...written.keys()].sort()).toEqual([
      '/app/lib/app.dart',
      '/app/lib/main.dart',
      '/app/lib/widgets/user_card.dart',
    ]);
    expect(written.get('/app/lib/app.dart')).toBe(
      '// dart for /app/src/App.tsx\n',
    );
    expect(written.get('/app/lib/main.dart')).toBe(
      mainDart({ name: 'Demo', rootImport: 'app.dart' }),
    );
  });

  test('compiles against the project’s own plugin extractions', async () => {
    const dirs: (readonly string[] | undefined)[] = [];
    const { deps } = harness(
      { 'App.tsx': 'export const App = () => <Text>hi</Text>;' },
      {
        transpile: (input): Promise<string> => {
          dirs.push(input.pluginApiDirs);
          return Promise.resolve('// dart\n');
        },
      },
    );

    await buildProject('/app', { name: 'Demo' }, deps);

    expect(dirs).toEqual([['/app/.fsx/api']]);
  });

  test('reports a project with no root component', () => {
    const { deps } = harness({
      'widgets/UserCard.tsx': 'export const UserCard = () => <Text>u</Text>;',
    });

    expect(buildProject('/app', { name: 'Demo' }, deps)).rejects.toThrow(
      '/app/src/App.tsx does not exist — the app needs a root component.',
    );
  });

  test('reports a project with no components at all', () => {
    const { deps } = harness({});

    expect(buildProject('/app', { name: 'Demo' }, deps)).rejects.toThrow(
      '/app/src/App.tsx does not exist — the app needs a root component.',
    );
  });
});

describe('buildProject — formatting', () => {
  test('formats the Dart it generated, so output is always canonical', async () => {
    const formatted: string[] = [];
    const { deps } = harness(
      { 'App.tsx': 'export const App = () => <Text>hi</Text>;' },
      {
        format: (outputDir): Promise<number> => {
          formatted.push(outputDir);
          return Promise.resolve(0);
        },
      },
    );

    await buildProject('/app', { name: 'Demo' }, deps);

    expect(formatted).toEqual(['/app/lib']);
  });

  test('reports a formatter that failed', () => {
    const { deps } = harness(
      { 'App.tsx': 'export const App = () => <Text>hi</Text>;' },
      { format: (): Promise<number> => Promise.resolve(65) },
    );

    expect(buildProject('/app', { name: 'Demo' }, deps)).rejects.toThrow(
      'formatting /app/lib failed (exit 65).',
    );
  });
});

describe('buildProject — a project that owns its entry point', () => {
  test('leaves a hand-written main.dart alone', async () => {
    const { deps, written } = harness(
      { 'App.tsx': 'export const App = () => <Text>hi</Text>;' },
      {
        readFile: (path): Promise<string> =>
          Promise.resolve(
            path.endsWith('/lib/main.dart')
              ? 'void main() { /* tray + window setup */ }\n'
              : 'export const App = () => <Text>hi</Text>;',
          ),
        pathExists: (path): Promise<boolean> =>
          Promise.resolve(path.endsWith('/lib/main.dart')),
      },
    );

    await buildProject('/app', { name: 'Demo' }, deps);

    // The component is still compiled; only the entry point is the app's own.
    expect(written.has('/app/lib/app.dart')).toBe(true);
    expect(written.has('/app/lib/main.dart')).toBe(false);
  });

  test('rewrites the entry point it generated itself', async () => {
    const { deps, written } = harness(
      { 'App.tsx': 'export const App = () => <Text>hi</Text>;' },
      {
        readFile: (path): Promise<string> =>
          Promise.resolve(
            path.endsWith('/lib/main.dart')
              ? mainDart({ name: 'Old', rootImport: 'app.dart' })
              : 'export const App = () => <Text>hi</Text>;',
          ),
        pathExists: (path): Promise<boolean> =>
          Promise.resolve(path.endsWith('/lib/main.dart')),
      },
    );

    await buildProject('/app', { name: 'Demo' }, deps);

    expect(written.get('/app/lib/main.dart')).toBe(
      mainDart({ name: 'Demo', rootImport: 'app.dart' }),
    );
  });
});
