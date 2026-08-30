import { describe, expect, test } from 'bun:test';

import { loadPluginApi } from '@src/plugins/api';
import { PLUGIN_OVERRIDES } from '@src/plugins/overrides';
import type { Recipe } from '@src/site/cookbook';
import { buildSitePlugins } from '@src/site/plugins';

const recipe = (id: string, tsx: string): Recipe => ({
  id,
  title: id,
  blurb: '',
  category: 'Start here',
  tsx,
  dart: "import 'package:flutter/material.dart';\n",
  files: [],
});

const cameraRecipe = recipe(
  '01-camera-screen',
  "import { useCamera } from 'plugin:camera';\n",
);
const urlRecipe = recipe(
  '13-open-link',
  "import { launchUrl } from 'plugin:url_launcher';\n",
);

describe('buildSitePlugins', () => {
  test('documents a hook with the signature its typings declare', async () => {
    const camera = await loadPluginApi('camera');

    const [plugin] = buildSitePlugins([camera], PLUGIN_OVERRIDES, [
      cameraRecipe,
    ]);

    expect(plugin?.package).toBe('camera');
    expect(plugin?.module).toBe('plugin:camera');
    expect(plugin?.version.length).toBeGreaterThan(0);

    const hook = plugin?.hooks.find((each) => each.name === 'useCamera');
    expect(hook?.signature).toBe(
      '(options?: { lens?: CameraLensDirection; lensType?: CameraLensType; ' +
        "resolution?: ResolutionPreset }) => Omit<CameraController, 'initialize' | 'dispose'>",
    );
    expect(hook?.manages).toEqual(['initialize', 'dispose']);
  });

  test('lists each option with its values and the default it falls back to', async () => {
    const camera = await loadPluginApi('camera');

    const [plugin] = buildSitePlugins([camera], PLUGIN_OVERRIDES, [
      cameraRecipe,
    ]);
    const hook = plugin?.hooks.find((each) => each.name === 'useCamera');

    const resolution = hook?.options.find(
      (option) => option.name === 'resolution',
    );
    expect(resolution?.type).toBe('ResolutionPreset');
    expect(resolution?.values).toContain('high');
    expect(resolution?.defaultValue).toBe('high');

    // A supplier filter has no default: omitting it keeps the first camera.
    const lens = hook?.options.find((option) => option.name === 'lens');
    expect(lens?.defaultValue).toBeNull();
  });

  test('carries the generated declaration the IDE reads', async () => {
    const camera = await loadPluginApi('camera');

    const [plugin] = buildSitePlugins([camera], PLUGIN_OVERRIDES, [
      cameraRecipe,
    ]);

    expect(plugin?.declaration).toContain("declare module 'plugin:camera' {");
    expect(plugin?.declaration).toContain('export const useCamera:');
  });

  test('attaches only the fixtures that import the plugin', async () => {
    const camera = await loadPluginApi('camera');

    const [plugin] = buildSitePlugins([camera], PLUGIN_OVERRIDES, [
      cameraRecipe,
      urlRecipe,
    ]);

    expect(plugin?.examples.map((each) => each.id)).toEqual([
      '01-camera-screen',
    ]);
  });

  test('refuses to document a plugin no fixture proves', async () => {
    const camera = await loadPluginApi('camera');

    // A documented plugin without a certified example is a claim, not a proof.
    expect(() =>
      buildSitePlugins([camera], PLUGIN_OVERRIDES, [urlRecipe]),
    ).toThrow('plugin camera has no fixture importing plugin:camera.');
  });

  test('states what a host app must declare for the plugin', async () => {
    const camera = await loadPluginApi('camera');

    const [plugin] = buildSitePlugins([camera], PLUGIN_OVERRIDES, [
      cameraRecipe,
    ]);

    expect(plugin?.requirements).toEqual([
      {
        platform: 'Android',
        kind: 'permissions',
        values: [
          'android.permission.CAMERA',
          'android.permission.RECORD_AUDIO',
          'android.permission.WRITE_EXTERNAL_STORAGE',
        ],
        // camera_android_camerax declares these itself; Gradle merges them.
        duty: 'merged',
      },
      {
        platform: 'iOS',
        kind: 'Info.plist usage descriptions',
        values: ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription'],
        duty: 'required',
      },
    ]);
  });

  test('states the query schemes a plugin needs declared', async () => {
    const urlLauncher = await loadPluginApi('url_launcher');

    const [plugin] = buildSitePlugins([urlLauncher], PLUGIN_OVERRIDES, [
      urlRecipe,
    ]);

    expect(plugin?.requirements).toEqual([
      {
        platform: 'Android',
        kind: 'query schemes',
        values: ['https', 'sms', 'tel'],
        // url_launcher_android's own manifest declares no <queries>; these
        // come from its example app, where each is shown as an if-your-app.
        duty: 'conditional',
      },
    ]);
  });

  test('records that a plugin needs nothing declared', async () => {
    const http = await loadPluginApi('http');

    const [plugin] = buildSitePlugins([http], PLUGIN_OVERRIDES, [
      recipe('25-http-get', "import { get } from 'plugin:http';\n"),
    ]);

    expect(plugin?.requirements).toEqual([]);
  });

  test('carries the top-level functions a hookless plugin is made of', async () => {
    const http = await loadPluginApi('http');

    const [plugin] = buildSitePlugins([http], PLUGIN_OVERRIDES, [
      recipe('25-http-get', "import { get } from 'plugin:http';\n"),
    ]);

    // http exposes no hook at all: an import line built from hooks alone
    // would name nothing a developer can write.
    expect(plugin?.hooks).toEqual([]);
    expect(plugin?.functions.find((fn) => fn.name === 'get')).toEqual({
      name: 'get',
      signature:
        '(url: string, options?: { headers?: Record<string, string> | null }) ' +
        '=> Promise<Response>',
      doc: 'Sends an HTTP GET request with the given headers to the given URL.',
    });
  });

  test('orders plugins by package name', async () => {
    const camera = await loadPluginApi('camera');
    const urlLauncher = await loadPluginApi('url_launcher');

    const plugins = buildSitePlugins([urlLauncher, camera], PLUGIN_OVERRIDES, [
      cameraRecipe,
      urlRecipe,
    ]);

    expect(plugins.map((each) => each.package)).toEqual([
      'camera',
      'url_launcher',
    ]);
  });
});
