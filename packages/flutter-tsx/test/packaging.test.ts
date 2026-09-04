import { describe, expect, test } from 'bun:test';

/**
 * What `npm publish` would ship, checked rather than assumed.
 *
 * Both packages were `private` with no file list, which meant publishing
 * either would have refused outright — and, once un-refused, would have
 * shipped the test suite, the fixtures and the sweep probes alongside the
 * compiler. The manifests carry that answer now, and this is what keeps
 * them carrying it.
 */
interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  files?: string[];
  engines?: Record<string, string>;
  bin?: Record<string, string>;
  dependencies?: Record<string, string>;
}

const read = async (name: string): Promise<Manifest> =>
  (await Bun.file(
    new URL(`../../${name}/package.json`, import.meta.url),
  ).json()) as Manifest;

const engine = await read('flutter-tsx');
const scaffolder = await read('create-flutter-tsx');

describe('the published packages', () => {
  test('are publishable at all', () => {
    for (const manifest of [engine, scaffolder]) {
      expect([manifest.name, manifest.private]).toEqual([
        manifest.name,
        undefined,
      ]);
      expect([manifest.name, manifest.engines?.bun]).toEqual([
        manifest.name,
        '>=1.4.0',
      ]);
    }
  });

  test('ship what they need at runtime, and nothing else', () => {
    // The snapshot is the compiler's input, the templates are what `fsx init`
    // copies, and both are as necessary as the source itself. Everything
    // absent from this list — tests, fixtures, sweep probes, the extractor,
    // the author-only scripts — is 50 MB nobody installing this needs.
    expect(engine.files).toEqual([
      'bin',
      'src',
      'templates',
      'ref/api.json',
      'ref/derived',
      'ref/plugins',
      'LICENSE',
    ]);
    expect(scaffolder.files).toEqual(['bin', 'src', 'LICENSE']);
  });

  test('name a command that exists', async () => {
    for (const manifest of [engine, scaffolder]) {
      for (const [command, path] of Object.entries(manifest.bin ?? {})) {
        const file = new URL(`../../${manifest.name}/${path}`, import.meta.url);
        expect([command, await Bun.file(file).exists()]).toEqual([
          command,
          true,
        ]);
      }
    }
  });

  test('the scaffolder depends on a version npm can resolve', () => {
    // `workspace:*` is how the repository links the two; published, it is a
    // range no registry can satisfy, so the version travels instead.
    expect(scaffolder.dependencies?.['flutter-tsx']).toBe(engine.version);
  });
});
