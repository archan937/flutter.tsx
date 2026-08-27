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
            paramName: 'description',
            paramType: 'CameraDescription',
            filters: [
              {
                fieldName: 'lensDirection',
                enumName: 'CameraLensDirection',
                optionName: 'lens',
              },
              {
                fieldName: 'lensType',
                enumName: 'CameraLensType',
                optionName: 'lensType',
              },
            ],
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
            name: 'lens',
            enumName: 'CameraLensDirection',
            values: ['front', 'back', 'external'],
            defaultMember: null,
          },
          {
            name: 'lensType',
            enumName: 'CameraLensType',
            values: ['wide', 'telephoto', 'ultraWide', 'unknown'],
            defaultMember: null,
          },
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

describe('deriveHooks — plain-constructor services (flutter_secure_storage)', () => {
  test('the package-named class with a const ctor derives a field hook', async () => {
    const api = await loadPluginApi('flutter_secure_storage');

    expect(deriveHooks(api, undefined)).toEqual([
      {
        hookName: 'useSecureStorage',
        className: 'FlutterSecureStorage',
        dartImport:
          'package:flutter_secure_storage/flutter_secure_storage.dart',
        acquisition: { kind: 'constField', isConst: true },
        construct: [],
        managed: [],
        options: [],
      },
    ]);
  });

  test('helper option classes never derive hooks of their own', async () => {
    const api = await loadPluginApi('flutter_secure_storage');
    const hookNames = deriveHooks(api, undefined).map((hook) => hook.hookName);

    expect(hookNames).toEqual(['useSecureStorage']);
  });
});

describe('deriveHooks — static factories beyond getInstance (package_info_plus)', () => {
  test('PackageInfo.fromPlatform derives with the existing pattern, zero data', async () => {
    const api = await loadPluginApi('package_info_plus');

    expect(deriveHooks(api, undefined)).toEqual([
      {
        hookName: 'usePackageInfo',
        className: 'PackageInfo',
        dartImport: 'package:package_info_plus/package_info_plus.dart',
        acquisition: { kind: 'staticFactory', method: 'fromPlatform' },
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
        fields: [],
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
