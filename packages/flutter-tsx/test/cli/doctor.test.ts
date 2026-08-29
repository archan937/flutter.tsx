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
