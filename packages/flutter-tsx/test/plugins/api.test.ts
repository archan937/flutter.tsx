import { describe, expect, test } from 'bun:test';

import { loadPluginApi, parsePluginApi } from '@src/plugins/api';

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
        'plugins/nonexistent.json does not exist — run ' +
          '`bun run extract:plugin nonexistent` first.',
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
