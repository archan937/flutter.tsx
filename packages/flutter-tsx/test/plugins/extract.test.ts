import { describe, expect, test } from 'bun:test';

import {
  createPluginExtractor,
  type ExtractorConfig,
} from '@src/plugins/extract';

interface Harness {
  config: ExtractorConfig;
  commands: string[][];
  ensured: string[];
}

const harness = (
  resolvedAlready: boolean,
  overrides: Partial<ExtractorConfig> = {},
): Harness => {
  const commands: string[][] = [];
  const ensured: string[] = [];

  return {
    commands,
    ensured,
    config: {
      flutterBin: '/sdk/bin/flutter',
      dartBin: '/sdk/bin/dart',
      dartSdkPath: '/sdk/bin/cache/dart-sdk',
      extractorDir: '/pkg/extractor',
      cacheDir: '/cache/plugins',
      runProcess: (command, cwd): Promise<number> => {
        commands.push([...command, `(in ${cwd})`]);
        return Promise.resolve(0);
      },
      pathExists: (): Promise<boolean> => Promise.resolve(resolvedAlready),
      ensureDir: (path): Promise<void> => {
        ensured.push(path);
        return Promise.resolve();
      },
      ...overrides,
    },
  };
};

const DART_RUN = [
  '/sdk/bin/dart',
  'run',
  'bin/extract_plugin.dart',
  '--package',
  'camera',
  '--project',
  '/app',
  '--sdk-path',
  '/sdk/bin/cache/dart-sdk',
  '--out',
  '/cache/plugins/camera@0.12.0.json',
  '(in /pkg/extractor)',
];

describe('createPluginExtractor', () => {
  test('resolves the extractor package once, then extracts', async () => {
    const { config, commands, ensured } = harness(false);

    const exitCode = await createPluginExtractor(config)(
      'camera',
      '/app',
      '/cache/plugins/camera@0.12.0.json',
    );

    expect(exitCode).toBe(0);
    expect(ensured).toEqual(['/cache/plugins']);
    expect(commands).toEqual([
      ['/sdk/bin/flutter', 'pub', 'get', '(in /pkg/extractor)'],
      DART_RUN,
    ]);
  });

  test('skips resolving when the extractor is already resolved', async () => {
    const { config, commands } = harness(true);

    const exitCode = await createPluginExtractor(config)(
      'camera',
      '/app',
      '/cache/plugins/camera@0.12.0.json',
    );

    expect(exitCode).toBe(0);
    expect(commands).toEqual([DART_RUN]);
  });

  test('reports a failed resolve without attempting extraction', async () => {
    const { config, commands } = harness(false, {
      runProcess: (): Promise<number> => Promise.resolve(69),
    });

    expect(
      await createPluginExtractor(config)(
        'camera',
        '/app',
        '/cache/plugins/camera@0.12.0.json',
      ),
    ).toBe(69);
    expect(commands).toEqual([]);
  });
});
