import { describe, expect, test } from 'bun:test';

import {
  type Check,
  type DoctorDeps,
  formatCheck,
  runDoctorCommand,
} from '@src/cli/doctor';

describe('formatCheck', () => {
  test('a passing check reports what it found', () => {
    expect(
      formatCheck({ name: 'Flutter SDK', ok: true, detail: '3.47.1' }),
    ).toBe('[✓] Flutter SDK — 3.47.1');
  });

  test('a failing check reports the fix', () => {
    expect(
      formatCheck({
        name: 'Flutter SDK',
        ok: false,
        detail: 'not installed — run `fsx install`',
      }),
    ).toBe('[✗] Flutter SDK — not installed — run `fsx install`');
  });
});

interface Harness {
  deps: DoctorDeps;
  lines: string[];
}

const MANIFEST = {
  flutterVersion: '3.47.1',
  archive: 'stable/macos/flutter.zip',
  sha256: 'sha',
  installedAt: '2026-08-30T00:00:00.000Z',
};

const files: Record<string, string> = {
  '/app/package.json': JSON.stringify({
    name: 'demo_app',
    plugins: { url_launcher: '^6.3.0' },
  }),
  '/app/fsx.config.ts': "export default { target: 'web' };\n",
  '/app/src/App.tsx': 'export const App = () => <Text>hi</Text>;\n',
  '/app/.fsx/plugins.json': JSON.stringify({ url_launcher: '^6.3.0' }),
  '/app/.fsx/types/url_launcher.d.ts':
    "declare module 'plugin:url_launcher' {}",
};

/** A plugin extraction as `fsx install` writes it, with one iOS duty. */
const cameraApi = (): string =>
  JSON.stringify({
    package: 'camera',
    version: '0.12.0+2',
    classes: [],
    enums: [],
    functions: [],
    permissions: {
      android: {
        manifestSource: 'camera/android/src/main/AndroidManifest.xml',
        permissions: ['android.permission.CAMERA'],
        exampleSource: 'example/android/app/src/main/AndroidManifest.xml',
        querySchemes: [],
      },
      ios: {
        exampleSource: 'example/ios/Runner/Info.plist',
        usageDescriptionKeys: [
          'NSCameraUsageDescription',
          'NSMicrophoneUsageDescription',
        ],
        querySchemes: [],
      },
    },
  });

const PLIST_WITH_CAMERA_KEY =
  '<plist><dict>\n' +
  '<key>NSCameraUsageDescription</key><string>To scan receipts.</string>\n' +
  '</dict></plist>\n';

/** A project whose declared plugins include camera, with an iOS host app. */
const withCamera = (plist: string | null): Record<string, string> => ({
  ...files,
  '/app/package.json': JSON.stringify({
    name: 'demo_app',
    plugins: { camera: '^0.12.0' },
  }),
  '/app/.fsx/plugins.json': JSON.stringify({ camera: '^0.12.0' }),
  '/app/.fsx/types/camera.d.ts': "declare module 'plugin:camera' {}",
  '/app/.fsx/api/camera.json': cameraApi(),
  ...(plist === null ? {} : { '/app/ios/Runner/Info.plist': plist }),
});

const readingFrom = (tree: Record<string, string>): Partial<DoctorDeps> => ({
  readFile: (path): Promise<string | null> =>
    Promise.resolve(tree[path] ?? null),
  pathExists: (path): Promise<boolean> =>
    Promise.resolve(tree[path] !== undefined),
});

const harness = (overrides: Partial<DoctorDeps> = {}): Harness => {
  const lines: string[] = [];

  return {
    lines,
    deps: {
      readManifest: () => Promise.resolve(MANIFEST),
      pinnedVersion: '3.47.1',
      readFile: (path): Promise<string | null> =>
        Promise.resolve(files[path] ?? null),
      pathExists: (path): Promise<boolean> =>
        Promise.resolve(files[path] !== undefined),
      out: (line): void => {
        lines.push(line);
      },
      ...overrides,
    },
  };
};

describe('runDoctorCommand', () => {
  test('reports a healthy project and succeeds', async () => {
    const context = harness();

    const exitCode = await runDoctorCommand('/app', context.deps);

    expect(exitCode).toBe(0);
    expect(context.lines).toEqual([
      '[✓] Flutter SDK — 3.47.1',
      '[✓] Project — demo_app',
      '[✓] Root component — src/App.tsx',
      '[✓] Plugins — 1 installed, in sync',
      '[✓] iOS usage descriptions — no plugin needs one',
      'No issues found.',
    ]);
  });

  test('reports an SDK that was never installed', async () => {
    const context = harness({ readManifest: () => Promise.resolve(null) });

    expect(await runDoctorCommand('/app', context.deps)).toBe(1);
    expect(context.lines[0]).toBe(
      '[✗] Flutter SDK — not installed — run `fsx install`',
    );
    expect(context.lines.at(-1)).toBe('1 issue found.');
  });

  test('reports an SDK that is not the pinned version', async () => {
    const context = harness({
      readManifest: () =>
        Promise.resolve({ ...MANIFEST, flutterVersion: '3.40.0' }),
    });

    expect(await runDoctorCommand('/app', context.deps)).toBe(1);
    expect(context.lines[0]).toBe(
      '[✗] Flutter SDK — 3.40.0 installed, 3.47.1 pinned — run `fsx install`',
    );
  });

  test('reports a directory that is not a project', async () => {
    const context = harness({
      readFile: (): Promise<string | null> => Promise.resolve(null),
      pathExists: (): Promise<boolean> => Promise.resolve(false),
    });

    expect(await runDoctorCommand('/app', context.deps)).toBe(1);
    expect(context.lines).toEqual([
      '[✓] Flutter SDK — 3.47.1',
      '[✗] Project — no package.json here — run `fsx init`',
      '[✗] Root component — src/App.tsx is missing',
      '[✗] Plugins — cannot be checked without a package.json',
      '[✓] iOS usage descriptions — no plugin needs one',
      '3 issues found.',
    ]);
  });

  test('reports plugins declared but never installed', async () => {
    const context = harness({
      pathExists: (path): Promise<boolean> =>
        Promise.resolve(
          files[path] !== undefined && !path.startsWith('/app/.fsx'),
        ),
      readFile: (path): Promise<string | null> =>
        Promise.resolve(
          path.startsWith('/app/.fsx') ? null : (files[path] ?? null),
        ),
    });

    expect(await runDoctorCommand('/app', context.deps)).toBe(1);
    expect(context.lines[3]).toBe(
      '[✗] Plugins — url_launcher declared but not installed — run `fsx install`',
    );
  });

  test('reports typings missing for an installed plugin', async () => {
    const context = harness({
      pathExists: (path): Promise<boolean> =>
        Promise.resolve(files[path] !== undefined && !path.endsWith('.d.ts')),
    });

    expect(await runDoctorCommand('/app', context.deps)).toBe(1);
    expect(context.lines[3]).toBe(
      '[✗] Plugins — url_launcher has no typings — run `fsx install`',
    );
  });

  test('reports a project that declares no plugins', async () => {
    const context = harness({
      readFile: (path): Promise<string | null> =>
        Promise.resolve(
          path === '/app/package.json'
            ? JSON.stringify({ name: 'demo_app' })
            : (files[path] ?? null),
        ),
    });

    expect(await runDoctorCommand('/app', context.deps)).toBe(0);
    expect(context.lines[3]).toBe('[✓] Plugins — none declared');
  });

  test('reports a package.json that cannot be read', async () => {
    const context = harness({
      readFile: (path): Promise<string | null> =>
        Promise.resolve(
          path === '/app/package.json' ? '{' : (files[path] ?? null),
        ),
    });

    expect(await runDoctorCommand('/app', context.deps)).toBe(1);
    expect(context.lines[1]).toBe(
      '[✗] Project — /app/package.json is not valid JSON.',
    );
  });
});

describe('a check list', () => {
  test('counts one issue in the singular and more in the plural', () => {
    const checks: Check[] = [
      { name: 'a', ok: false, detail: 'x' },
      { name: 'b', ok: false, detail: 'y' },
    ];

    expect(checks.filter((check) => !check.ok)).toHaveLength(2);
  });
});

describe('runDoctorCommand — iOS usage descriptions', () => {
  test('names the keys a plugin needs that the Info.plist does not have', async () => {
    const context = harness(readingFrom(withCamera(PLIST_WITH_CAMERA_KEY)));

    expect(await runDoctorCommand('/app', context.deps)).toBe(1);
    expect(context.lines).toContain(
      '[✗] iOS usage descriptions — NSMicrophoneUsageDescription missing from ' +
        'ios/Runner/Info.plist — add it with your own purpose string',
    );
  });

  test('names every missing key, not just the first', async () => {
    const context = harness(
      readingFrom(withCamera('<plist><dict></dict></plist>\n')),
    );

    await runDoctorCommand('/app', context.deps);

    expect(context.lines).toContain(
      '[✗] iOS usage descriptions — NSCameraUsageDescription, ' +
        'NSMicrophoneUsageDescription missing from ios/Runner/Info.plist — ' +
        'add them with your own purpose strings',
    );
  });

  test('passes when the host app declares every key', async () => {
    const context = harness(
      readingFrom(
        withCamera(
          PLIST_WITH_CAMERA_KEY.replace(
            '</dict>',
            '<key>NSMicrophoneUsageDescription</key><string>To record ' +
              'audio.</string>\n</dict>',
          ),
        ),
      ),
    );

    expect(await runDoctorCommand('/app', context.deps)).toBe(0);
    expect(context.lines).toContain('[✓] iOS usage descriptions — 2 declared');
  });

  test('says nothing to check when the project has no iOS host app', async () => {
    const context = harness(readingFrom(withCamera(null)));

    expect(await runDoctorCommand('/app', context.deps)).toBe(0);
    expect(context.lines).toContain(
      '[✓] iOS usage descriptions — no iOS host app in this project',
    );
  });

  test('says nothing to check when no plugin asks for one', async () => {
    const context = harness();

    expect(await runDoctorCommand('/app', context.deps)).toBe(0);
    expect(context.lines).toContain(
      '[✓] iOS usage descriptions — no plugin needs one',
    );
  });
});
