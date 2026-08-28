import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  loadPluginApi,
  manifestRequirements,
  parsePluginApi,
} from '@src/plugins/api';

describe('loadPluginApi — committed camera api', () => {
  test('parses the full document with exact ground truths', async () => {
    const api = await loadPluginApi('camera');

    expect(api.package).toBe('camera');
    expect(api.version).toBe('0.12.0+2');
    expect(api.classes.map((entity) => entity.name)).toEqual([
      'CameraController',
      'CameraDescription',
      'CameraException',
      'CameraImage',
      'CameraPreview',
      'CameraValue',
      'ImageFormat',
      'Optional',
      'Plane',
      'XFile',
    ]);

    const controller = api.classes.find(
      (entity) => entity.name === 'CameraController',
    );
    const constructor = controller?.constructors.find(
      (candidate) => candidate.name === '',
    );
    expect(constructor?.params.slice(0, 2).map((param) => param.name)).toEqual([
      'description',
      'resolutionPreset',
    ]);

    const methodNamed = (
      name: string,
    ): { returnType: unknown; isStatic: boolean } | undefined =>
      controller?.methods.find((method) => method.name === name);
    expect(methodNamed('initialize')?.returnType).toEqual({
      kind: 'future',
      item: { kind: 'void' },
    });
    expect(methodNamed('initialize')?.isStatic).toBe(false);
    expect(methodNamed('takePicture')?.returnType).toEqual({
      kind: 'future',
      item: { kind: 'named', name: 'XFile' },
    });
    expect(methodNamed('dispose')?.returnType).toEqual({
      kind: 'future',
      item: { kind: 'void' },
    });

    expect(
      api.enums.find((entity) => entity.name === 'ResolutionPreset')?.values,
    ).toEqual(['low', 'medium', 'high', 'veryHigh', 'ultraHigh', 'max']);

    const description = api.classes.find(
      (entity) => entity.name === 'CameraDescription',
    );
    expect(description?.fields.find((field) => field.name === 'name')).toEqual({
      name: 'name',
      doc: '/// The name of the camera device.',
      type: { kind: 'scalar', name: 'String' },
    });
    expect(description?.fields.map((field) => field.name)).toEqual([
      'lensDirection',
      'lensType',
      'name',
      'sensorOrientation',
    ]);

    expect(api.permissions).toEqual({
      android: {
        manifestSource:
          'camera_android_camerax/android/src/main/AndroidManifest.xml',
        permissions: [
          'android.permission.CAMERA',
          'android.permission.RECORD_AUDIO',
          'android.permission.WRITE_EXTERNAL_STORAGE',
        ],
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
    });

    expect(api.functions.map((entity) => entity.name)).toEqual([
      'availableCameras',
    ]);
    expect(api.functions[0]?.returnType).toEqual({
      kind: 'future',
      item: {
        kind: 'list',
        item: { kind: 'named', name: 'CameraDescription' },
      },
    });
  });

  test('a plugin without a committed api is a loud error', () => {
    expect(loadPluginApi('nonexistent')).rejects.toThrow(
      new Error(
        `no extracted API for nonexistent — add it to the "plugins" map in ` +
          'package.json and run `fsx install`.',
      ),
    );
  });
});

describe('parsePluginApi — malformed documents', () => {
  test('a non-object root fails with the document label', () => {
    expect(() => parsePluginApi(42, 'plugins/camera.json')).toThrow(
      new Error('plugins/camera.json: root: expected an object'),
    );
  });

  test('a malformed method fails with a precise path', () => {
    expect(() =>
      parsePluginApi(
        {
          package: 'demo',
          version: '1.0.0',
          classes: [
            {
              name: 'Demo',
              doc: '',
              constructors: [],
              fields: [],
              methods: [{ name: 'run', doc: '', static: false, params: [] }],
              constants: [],
            },
          ],
          enums: [],
          functions: [],
        },
        'plugins/demo.json',
      ),
    ).toThrow(
      new Error(
        'plugins/demo.json: classes[0].methods[0].returnType: ' +
          'expected an object',
      ),
    );
  });
});
describe('manifestRequirements — what a host app must declare', () => {
  test('merges every used plugin, keeping each requirement sourced', async () => {
    const camera = await loadPluginApi('camera');
    const launcher = await loadPluginApi('url_launcher');

    expect(manifestRequirements([camera, launcher])).toEqual({
      android: {
        permissions: [
          'android.permission.CAMERA',
          'android.permission.RECORD_AUDIO',
          'android.permission.WRITE_EXTERNAL_STORAGE',
        ],
        querySchemes: ['https', 'sms', 'tel'],
      },
      ios: {
        usageDescriptionKeys: [
          'NSCameraUsageDescription',
          'NSMicrophoneUsageDescription',
        ],
        querySchemes: [],
      },
      unknown: [],
    });
  });

  test('a plugin with no artifact is reported, never silently empty', () => {
    const blind = {
      package: 'ghost',
      version: '1.0.0',
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
    };

    expect(manifestRequirements([blind])).toEqual({
      android: { permissions: [], querySchemes: [] },
      ios: { usageDescriptionKeys: [], querySchemes: [] },
      unknown: [
        'ghost: no Android manifest found',
        'ghost: no example Android manifest found',
        'ghost: no example Info.plist found',
      ],
    });
  });
});

describe('loadPluginApi — project extractions', () => {
  test('prefers a project extraction over the bundled reference set', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-api-'));
    const bundled = await loadPluginApi('camera');
    const raw = (await Bun.file(
      new URL('../../ref/plugins/camera.json', import.meta.url).pathname,
    ).json()) as Record<string, unknown>;
    await Bun.write(
      join(dir, 'camera.json'),
      JSON.stringify({ ...raw, version: '99.0.0' }),
    );

    expect((await loadPluginApi('camera', [dir])).version).toBe('99.0.0');
    expect(bundled.version).not.toBe('99.0.0');

    await rm(dir, { recursive: true, force: true });
  });

  test('falls back to the bundled set when the project has no extraction', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-api-'));

    expect((await loadPluginApi('camera', [dir])).package).toBe('camera');

    await rm(dir, { recursive: true, force: true });
  });
});
