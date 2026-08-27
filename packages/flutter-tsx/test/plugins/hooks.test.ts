import { describe, expect, test } from 'bun:test';

import type { ParamModel } from '@src/api/model';
import { loadPluginApi, type PluginApi } from '@src/plugins/api';
import { deriveHooks } from '@src/plugins/hooks';
import { PLUGIN_OVERRIDES } from '@src/plugins/overrides';

describe('deriveHooks — camera', () => {
  test('CameraController derives useCamera with its lifecycle plan', async () => {
    const api = await loadPluginApi('camera');

    expect(deriveHooks(api, PLUGIN_OVERRIDES.camera)).toEqual([
      {
        hookName: 'useCamera',
        className: 'CameraController',
        dartImport: 'package:camera/camera.dart',
        acquisition: { kind: 'constructor' },
        construct: [
          {
            kind: 'supplierFirst',
            functionName: 'availableCameras',
            paramType: 'CameraDescription',
          },
          {
            kind: 'enumDefault',
            enumName: 'ResolutionPreset',
            member: 'high',
            optionName: 'resolution',
          },
        ],
        managed: ['initialize', 'dispose'],
        options: [
          {
            name: 'resolution',
            enumName: 'ResolutionPreset',
            values: ['low', 'medium', 'high', 'veryHigh', 'ultraHigh', 'max'],
            defaultMember: 'high',
          },
        ],
      },
    ]);
  });

  test('a controller with an enum param but no default derives nothing', async () => {
    const api = await loadPluginApi('camera');

    expect(deriveHooks(api, undefined)).toEqual([]);
  });
});

describe('deriveHooks — singleton services (shared_preferences)', () => {
  test('a static async factory derives a singleton hook, zero overrides', async () => {
    const api = await loadPluginApi('shared_preferences');

    expect(deriveHooks(api, PLUGIN_OVERRIDES.shared_preferences)).toEqual([
      {
        hookName: 'useSharedPreferences',
        className: 'SharedPreferences',
        dartImport: 'package:shared_preferences/shared_preferences.dart',
        acquisition: { kind: 'staticFactory', method: 'getInstance' },
        construct: [],
        managed: [],
        options: [],
      },
    ]);
  });
});

describe('deriveHooks — underivable shapes', () => {
  const lifecycleMethods = [
    {
      name: 'initialize',
      doc: '',
      isStatic: false,
      returnType: { kind: 'future', item: { kind: 'void' } } as const,
      params: [],
    },
    {
      name: 'dispose',
      doc: '',
      isStatic: false,
      returnType: { kind: 'future', item: { kind: 'void' } } as const,
      params: [],
    },
  ];
  const requiredParam = (
    name: string,
    type: { kind: 'named'; name: string } | { kind: 'scalar'; name: 'int' },
  ): ParamModel => ({
    name,
    type,
    display: 'x',
    named: false,
    required: true,
    defaultValue: null,
    doc: '',
    deprecated: false,
  });
  const controller = (
    params: ParamModel[],
    constructors = true,
  ): PluginApi => ({
    package: 'demo',
    version: '1.0.0',
    classes: [
      {
        name: 'DemoController',
        doc: '',
        constructors: constructors
          ? [
              {
                name: '',
                doc: '',
                isConst: false,
                paramMemberAsserts: false,
                params,
              },
            ]
          : [],
        methods: lifecycleMethods,
        constants: [],
      },
    ],
    enums: [],
    functions: [],
  });

  test('no default constructor derives nothing', () => {
    expect(deriveHooks(controller([], false), undefined)).toEqual([]);
  });

  test('a named param without a supplier derives nothing', () => {
    expect(
      deriveHooks(
        controller([
          requiredParam('engine', { kind: 'named', name: 'Engine' }),
        ]),
        undefined,
      ),
    ).toEqual([]);
  });

  test('a scalar required param derives nothing', () => {
    expect(
      deriveHooks(
        controller([requiredParam('count', { kind: 'scalar', name: 'int' })]),
        undefined,
      ),
    ).toEqual([]);
  });
});
