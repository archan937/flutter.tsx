import { describe, expect, test } from 'bun:test';

import type { Recipe } from '@src/site/cookbook';
import { exampleFrom, loadSiteSections } from '@src/site/sections';

describe('exampleFrom', () => {
  test('refuses to open the reference with a fixture the suite lost', () => {
    expect(() => exampleFrom([])).toThrow(
      'the example fixture 01-camera-screen is missing.',
    );
  });

  test('carries the fixture pair verbatim', () => {
    const recipe: Recipe = {
      id: '01-camera-screen',
      title: 'Camera Screen',
      tsx: "import { useCamera } from 'plugin:camera';\n",
      dart: "import 'package:camera/camera.dart';\n",
    };

    expect(exampleFrom([recipe])).toEqual({
      id: '01-camera-screen',
      title: 'Camera Screen',
      tsx: "import { useCamera } from 'plugin:camera';\n",
      dart: "import 'package:camera/camera.dart';\n",
    });
  });
});

describe('loadSiteSections', () => {
  test('assembles every documented plugin from the reference set', async () => {
    const sections = await loadSiteSections();

    expect(sections.plugins.map((plugin) => plugin.package)).toEqual([
      'camera',
      'connectivity_plus',
      'flutter_secure_storage',
      'http',
      'package_info_plus',
      'shared_preferences',
      'url_launcher',
    ]);
    expect(sections.example.id).toBe('01-camera-screen');
    expect(sections.coreApi.length).toBeGreaterThan(0);
    expect(sections.generatedFiles.length).toBeGreaterThan(0);
  }, 60000);
});
