import { describe, expect, test } from 'bun:test';

import {
  type BuildDeps,
  buildProject,
  dartFileFor,
  GENERATED_ENTRY,
  mainDart,
} from '@src/build/project';
import type { TranspileResult } from '@src/compiler/transpile';

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
  // The root component owns its own chrome — an app with an AppBar, a drawer
  // or tabs renders one Scaffold of its own rather than nesting inside one
  // the entry point imposed.
  test('hosts the root component in a titled MaterialApp', () => {
    expect(mainDart({ name: 'Demo App', rootImport: 'app.dart' })).toBe(
      `${GENERATED_ENTRY}
import 'package:flutter/material.dart';

import 'app.dart';

void main() {
  runApp(const MaterialApp(title: 'Demo App', home: App()));
}
`,
    );
  });

  // A router that nothing is wired to cannot route: `context.push('/detail')`
  // needs the GoRouter the app declared to be the one MaterialApp runs.
  test('runs the router the app declares', () => {
    expect(
      mainDart({
        name: 'Demo App',
        rootImport: 'app.dart',
        router: { import: 'routes.dart', name: 'router' },
      }),
    ).toBe(
      `${GENERATED_ENTRY}
import 'package:flutter/material.dart';

import 'routes.dart';

void main() {
  runApp(MaterialApp.router(title: 'Demo App', routerConfig: router));
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
      transpile: (input): Promise<TranspileResult> =>
        Promise.resolve({
          dart: `// dart for ${input.filePath}\n`,
          router: input.filePath.endsWith('routes.tsx') ? 'router' : null,
        }),
      pathExists: (): Promise<boolean> => Promise.resolve(false),
      format: (): Promise<number> => Promise.resolve(0),
      ...overrides,
    },
  };
};

describe('buildProject', () => {
  test('the entry point runs the router a file in the project declares', async () => {
    const { deps, written } = harness({
      'App.tsx': 'export const App = () => <Text>hi</Text>;',
      'routes.tsx': 'export const router = createRouter({});',
    });

    await buildProject('/app', { name: 'Demo' }, deps);

    expect(written.get('/app/lib/main.dart')).toBe(
      mainDart({
        name: 'Demo',
        rootImport: 'app.dart',
        router: { import: 'routes.dart', name: 'router' },
      }),
    );
  });

  test('a routed app needs no root component: the router is the root', async () => {
    const { deps, written } = harness({
      'routes.tsx': 'export const router = createRouter({});',
    });

    await buildProject('/app', { name: 'Demo' }, deps);

    expect(written.get('/app/lib/main.dart')).toBe(
      mainDart({
        name: 'Demo',
        rootImport: 'app.dart',
        router: { import: 'routes.dart', name: 'router' },
      }),
    );
  });

  test('an app with neither a root component nor a router is reported', () => {
    const { deps } = harness({
      'components/Card.tsx': 'export const Card = () => <Text>c</Text>;',
    });

    expect(buildProject('/app', { name: 'Demo' }, deps)).rejects.toThrow(
      new Error(
        '/app/src has neither App.tsx nor a router — an app needs one of ' +
          'them to start from.',
      ),
    );
  });

  test('two routers are reported rather than one of them silently winning', () => {
    const { deps } = harness({
      'App.tsx': 'export const App = () => <Text>hi</Text>;',
      'routes.tsx': 'export const router = createRouter({});',
      'more/routes.tsx': 'export const router = createRouter({});',
    });

    expect(buildProject('/app', { name: 'Demo' }, deps)).rejects.toThrow(
      new Error(
        'more/routes.tsx and routes.tsx both declare a router — an app runs one.',
      ),
    );
  });

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
        transpile: (input): Promise<TranspileResult> => {
          dirs.push(input.pluginApiDirs);
          return Promise.resolve({ dart: '// dart\n', router: null });
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
      '/app/src has neither App.tsx nor a router — an app needs one of them to start from.',
    );
  });

  test('reports a project with no components at all', () => {
    const { deps } = harness({});

    expect(buildProject('/app', { name: 'Demo' }, deps)).rejects.toThrow(
      '/app/src has neither App.tsx nor a router — an app needs one of them to start from.',
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
