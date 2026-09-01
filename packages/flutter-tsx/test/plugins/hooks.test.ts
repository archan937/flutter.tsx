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
        listener: null,
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
        listener: null,
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
        listener: null,
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
        listener: null,
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
        supertypes: [],
        constructors: constructors
          ? [
              {
                name: '',
                doc: '',
                isConst: false,
                paramMemberAsserts: false,
                requiredOneOf: [],
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
    instances: [],
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
// The pub "plus family" (connectivity_plus, battery_plus, sensors_plus) drops
// the suffix in its class names, so the service match has to as well.
describe('deriveHooks — plus-family services', () => {
  test('connectivity_plus derives useConnectivity as a service', async () => {
    const api = await loadPluginApi('connectivity_plus');

    expect(deriveHooks(api, PLUGIN_OVERRIDES.connectivity_plus)).toEqual([
      {
        hookName: 'useConnectivity',
        className: 'Connectivity',
        dartImport: 'package:connectivity_plus/connectivity_plus.dart',
        acquisition: { kind: 'constField', isConst: false },
        construct: [],
        managed: [],
        options: [],
        listener: null,
      },
    ]);
  });

  test('package_info_plus still derives its static factory, not a service', async () => {
    const api = await loadPluginApi('package_info_plus');
    const [hook] = deriveHooks(api, undefined);

    expect(hook?.hookName).toBe('usePackageInfo');
    expect(hook?.acquisition).toEqual({
      kind: 'staticFactory',
      method: 'fromPlatform',
    });
  });
});

describe('deriveHooks — listeners', () => {
  test('derives the mixin a plugin reports through, and its events', async () => {
    const api = await loadPluginApi('tray_manager');

    const [hook] = deriveHooks(api, undefined).filter(
      (candidate) => candidate.hookName === 'useTrayManager',
    );

    // Derived from the shape — a class with addListener(X)/removeListener(X)
    // reports through X — not from the package's name.
    expect(hook?.listener?.className).toBe('TrayListener');
    expect(hook?.listener?.addMethod).toBe('addListener');
    expect(hook?.listener?.removeMethod).toBe('removeListener');
    expect(hook?.listener?.events.map((event) => event.name)).toEqual([
      'onTrayIconMouseDown',
      'onTrayIconMouseUp',
      'onTrayIconRightMouseDown',
      'onTrayIconRightMouseUp',
      'onTrayMenuItemClick',
    ]);
  });

  test('an event carries the parameters it delivers', async () => {
    const api = await loadPluginApi('tray_manager');

    const [hook] = deriveHooks(api, undefined).filter(
      (candidate) => candidate.hookName === 'useTrayManager',
    );
    const click = hook?.listener?.events.find(
      (event) => event.name === 'onTrayMenuItemClick',
    );

    // Named on both sides: the Dart type the override declares, and the type
    // the callback receives in the editor.
    expect(click?.params).toEqual([
      {
        name: 'menuItem',
        type: { kind: 'named', name: 'MenuItem' },
        dartType: 'MenuItem',
      },
    ]);
  });

  test('a plugin with no listener derives none', async () => {
    const api = await loadPluginApi('camera');

    for (const hook of deriveHooks(api, PLUGIN_OVERRIDES.camera)) {
      expect([hook.hookName, hook.listener]).toEqual([hook.hookName, null]);
    }
  });
});

describe('deriveHooks — a listener the package does not declare', () => {
  const method = (
    name: string,
    params: ParamModel[] = [],
  ): PluginApi['classes'][number]['methods'][number] => ({
    name,
    doc: '',
    isStatic: false,
    returnType: { kind: 'void' },
    params,
  });

  const listenerParam: ParamModel = {
    name: 'listener',
    type: { kind: 'named', name: 'GhostListener' },
    display: 'GhostListener',
    named: false,
    required: true,
    defaultValue: null,
    doc: '',
    deprecated: false,
  };

  const service = (
    methods: PluginApi['classes'][number]['methods'],
  ): PluginApi => ({
    package: 'demo',
    version: '1.0.0',
    classes: [
      {
        name: 'Demo',
        doc: '',
        supertypes: [],
        constructors: [
          {
            name: '',
            doc: '',
            isConst: false,
            paramMemberAsserts: false,
            requiredOneOf: [],
            params: [],
          },
        ],
        fields: [],
        methods,
        constants: [],
      },
    ],
    enums: [],
    functions: [],
    instances: [],
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
  });

  test('a listener type the package never exports derives no listener', () => {
    // Registering something the package does not declare cannot be typed, so
    // the hook offers no events rather than events nothing can satisfy.
    const [hook] = deriveHooks(
      service([
        method('addListener', [listenerParam]),
        method('removeListener', [listenerParam]),
        method('work'),
      ]),
      undefined,
    );

    expect(hook?.listener).toBeNull();
  });

  test('a class that registers but never unregisters derives no listener', () => {
    const [hook] = deriveHooks(
      service([method('addListener', [listenerParam]), method('work')]),
      undefined,
    );

    expect(hook?.listener).toBeNull();
  });
});
