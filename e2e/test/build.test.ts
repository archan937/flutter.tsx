import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import {
  artifactPath,
  defaultInitDeps,
  runBuildCommand,
  runInitCommand,
} from 'flutter-tsx/cli';
import { loadAppConfig } from 'flutter-tsx/cli';

import { dartBin, flutterBin } from './support/flutter-app';
import { commandRunner, pathExists } from './support/io';

const APP = `import { Center, Column, Text, useState } from 'flutter-tsx';

export const App = () => {
  const [count, setCount] = useState(0);

  const bump = () => {
    setCount(count + 1);
  };

  return (
    <Center>
      <Column>
        <Text>Count: {count}</Text>
        <Text onClick={bump}>Tap</Text>
      </Column>
    </Center>
  );
};
`;

const deps = (out: string[]) => ({
  loadConfig: loadAppConfig,
  build: async (projectDir: string, config: { name: string }) => {
    const { defaultDevDeps } = await import('flutter-tsx/cli');
    return defaultDevDeps({ flutterBin, dartBin }).build(projectDir, {
      ...config,
      bundleId: 'dev.fluttertsx.demo',
      target: 'web' as const,
    });
  },
  runFlutter: commandRunner(flutterBin),
  pathExists,
  out: (line: string): void => {
    out.push(line);
  },
});

/**
 * `fsx build` on a project nobody has hand-edited: the web build, and the
 * macOS build of the same sources, which scaffolds the platform first.
 */
describe('fsx build', () => {
  test('builds a scaffolded project for web and for macOS', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'fsx-build-'));
    const appDir = join(parent, 'build-app');

    await runInitCommand(appDir, {
      ...defaultInitDeps(),
      out: () => undefined,
    });
    await Bun.write(join(appDir, 'src', 'App.tsx'), APP);
    await rm(join(appDir, 'test'), { recursive: true, force: true });

    const lines: string[] = [];
    await runBuildCommand(appDir, [], deps(lines));

    expect(lines).toEqual([
      'Building build_app for web…',
      `Built ${artifactPath('web')}`,
    ]);
    expect(
      await Bun.file(join(appDir, 'build', 'web', 'main.dart.js')).exists(),
    ).toBe(true);

    // The same sources, built for a platform the project never had.
    const desktop: string[] = [];
    await runBuildCommand(appDir, ['--target=macos'], deps(desktop));

    expect(desktop).toEqual([
      'Building build_app for macos…',
      `Built ${artifactPath('macos')}`,
    ]);
    expect(await pathExists(join(appDir, 'macos'))).toBe(true);
    expect(
      await pathExists(
        join(appDir, 'build', 'macos', 'Build', 'Products', 'Release'),
      ),
    ).toBe(true);

    await rm(parent, { recursive: true, force: true });
  }, 1800000);
});
