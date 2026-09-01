import type { TypeNode } from '../api/model';
import { dartTypeOf } from '../derive/dart-types';
import type { PluginApi, PluginClass } from './api';

export interface SupplierFilter {
  fieldName: string;
  enumName: string;
  optionName: string;
}

export type ConstructArg =
  | {
      kind: 'supplierFirst';
      functionName: string;
      paramName: string;
      paramType: string;
      filters: SupplierFilter[];
    }
  | {
      kind: 'enumDefault';
      enumName: string;
      member: string;
      optionName: string;
    };

export interface HookOption {
  name: string;
  enumName: string;
  values: string[];
  // null for a supplier filter: omitting it keeps the supplier's first item.
  defaultMember: string | null;
}

export type HookAcquisition =
  | { kind: 'constructor' }
  | { kind: 'staticFactory'; method: string }
  | { kind: 'constField'; isConst: boolean }
  // `final trayManager = TrayManager.instance;` — the package already holds
  // the instance, so the hook hands back that one rather than making another.
  | { kind: 'topLevelInstance'; instanceName: string };

/**
 * Whether the handle is null until the hook has built it.
 *
 * A constructed or factory-opened handle only exists once `initState` has run,
 * so the first `build` sees null. The typings say so and the compiler guards
 * on it, both from here, so the two can never drift apart.
 */
export const isNullableHandle = (acquisition: HookAcquisition): boolean =>
  acquisition.kind === 'constructor' || acquisition.kind === 'staticFactory';

/** One value an event hands over, named on both sides of the compiler. */
export interface HookEventParam {
  name: string;
  type: TypeNode;
  dartType: string;
}

/** One callback a plugin's listener delivers, e.g. `onTrayMenuItemClick`. */
export interface HookEvent {
  name: string;
  params: HookEventParam[];
}

/**
 * How a plugin reports back: a mixin the widget implements, registered with
 * the instance while it is mounted. Derived from the shape rather than named
 * per package — a class with `addListener(X)`/`removeListener(X)` reports
 * through `X`, which is how both tray_manager and window_manager are built.
 */
export interface HookListener {
  className: string;
  addMethod: string;
  removeMethod: string;
  events: HookEvent[];
}

export interface DerivedHook {
  hookName: string;
  className: string;
  dartImport: string;
  acquisition: HookAcquisition;
  construct: ConstructArg[];
  managed: string[];
  options: HookOption[];
  listener: HookListener | null;
}

export interface HookOverrides {
  enumDefaults: Record<string, string>;
  optionNames?: Record<string, string>;
}

/// Per-package deltas that are not about a hook: whether the Dart import
/// carries a prefix, which `package:http` documents for itself because bare
/// `get`/`post` would collide and read poorly.
export interface PackageOverrides {
  importPrefix?: string;
}

const LISTENER_PAIR = { add: 'addListener', remove: 'removeListener' };

/** The listener mixin a class reports through, when it has one. */
const listenerOf = (
  api: PluginApi,
  entity: PluginClass,
): HookListener | null => {
  const register = entity.methods.find(
    (method) =>
      method.name === LISTENER_PAIR.add &&
      method.params.length === 1 &&
      method.params[0]?.type.kind === 'named',
  );
  const param = register?.params[0];
  if (register === undefined || param === undefined) {
    return null;
  }
  const className = param.type.kind === 'named' ? param.type.name : '';
  const unregister = entity.methods.find(
    (method) => method.name === LISTENER_PAIR.remove,
  );
  const listener = api.classes.find(
    (candidate) => candidate.name === className,
  );
  if (unregister === undefined || listener === undefined) {
    return null;
  }
  // Every callback the mixin declares is an event, and each returns nothing:
  // a listener reports, it does not answer.
  // An event whose values have no Dart name is not offered at all, rather
  // than typed in the editor and refused by the compiler later.
  const events = listener.methods
    .filter((method) => !method.isStatic && method.returnType.kind === 'void')
    .flatMap((method): HookEvent[] => {
      const params = method.params.map((param) => ({
        name: param.name,
        type: param.type,
        dartType: dartTypeOf(param.type),
      }));
      return params.some((param) => param.dartType === null)
        ? []
        : [
            {
              name: method.name,
              params: params.filter(
                (param): param is HookEventParam => param.dartType !== null,
              ),
            },
          ];
    });
  return events.length === 0
    ? null
    : {
        className,
        addMethod: register.name,
        removeMethod: unregister.name,
        events,
      };
};

const isFutureVoid = (type: TypeNode): boolean =>
  type.kind === 'future' && type.item.kind === 'void';

// The pub "plus family" (connectivity_plus, battery_plus, sensors_plus) names
// its classes without the suffix, so drop it before matching.
/**
 * Whether a class is a service: something you make once and then ask to do
 * work.
 *
 * Recognised by shape, never by name. A service can be constructed with
 * nothing — `FlutterSecureStorage()`, `Client()` — and its instance methods
 * hand back futures or streams, which is what asking a platform to do
 * something looks like. A value class with the same empty constructor has no
 * such methods, and an options bag has none at all.
 *
 * Matching on the package's own name instead left every second service in a
 * package extracted and unusable: `SharedPreferencesAsync` beside
 * `SharedPreferences`, and the whole of `http` behind `Client`.
 */
const serviceConstructor = (
  api: PluginApi,
  entity: PluginClass,
): { isConst: boolean } | null => {
  const constructor = entity.constructors.find(
    (candidate) => candidate.name === '',
  );
  const doesWork = entity.methods.some(
    (method) =>
      !method.isStatic &&
      (method.returnType.kind === 'future' ||
        method.returnType.kind === 'stream'),
  );
  if (
    constructor === undefined ||
    !doesWork ||
    constructor.params.some((param) => param.required)
  ) {
    return null;
  }
  return { isConst: constructor.isConst };
};

const staticFactoryOf = (entity: PluginClass): string | null => {
  const factory = entity.methods.find(
    (method) =>
      method.isStatic &&
      method.params.every((param) => !param.required) &&
      method.returnType.kind === 'future' &&
      method.returnType.item.kind === 'named' &&
      method.returnType.item.name === entity.name,
  );
  return factory?.name ?? null;
};

const hasLifecycle = (entity: PluginClass): boolean => {
  const returnTypeOf = (name: string): TypeNode | undefined =>
    entity.methods.find((method) => method.name === name)?.returnType;
  const initialize = returnTypeOf('initialize');
  const dispose = returnTypeOf('dispose');
  return (
    initialize !== undefined &&
    isFutureVoid(initialize) &&
    dispose !== undefined &&
    isFutureVoid(dispose)
  );
};

// Every enum-typed field on the supplied type becomes an optional filter:
// omitting it keeps the supplier's first item, passing it selects by that
// field. Naming follows the same optionNames override as enum defaults.
const supplierFilters = (
  api: PluginApi,
  paramType: string,
  overrides: HookOverrides | undefined,
): SupplierFilter[] =>
  (api.classes.find((candidate) => candidate.name === paramType)?.fields ?? [])
    .filter((field) => field.type.kind === 'enum')
    .map((field) => ({
      fieldName: field.name,
      enumName: field.type.kind === 'enum' ? field.type.name : '',
      optionName: overrides?.optionNames?.[field.name] ?? field.name,
    }));

const supplierFor = (
  api: PluginApi,
  param: { name: string; typeName: string },
  overrides: HookOverrides | undefined,
): ConstructArg | null => {
  const { name: paramName, typeName: paramType } = param;
  const supplier = api.functions.find(
    (candidate) =>
      candidate.params.length === 0 &&
      candidate.returnType.kind === 'future' &&
      candidate.returnType.item.kind === 'list' &&
      candidate.returnType.item.item.kind === 'named' &&
      candidate.returnType.item.item.name === paramType,
  );
  return supplier === undefined
    ? null
    : {
        kind: 'supplierFirst',
        functionName: supplier.name,
        paramName,
        paramType,
        filters: supplierFilters(api, paramType, overrides),
      };
};

interface ConstructDerivation {
  plan: ConstructArg[];
  options: HookOption[];
}

const constructPlan = (
  api: PluginApi,
  entity: PluginClass,
  overrides: HookOverrides | undefined,
): ConstructDerivation | null => {
  const constructor = entity.constructors.find(
    (candidate) => candidate.name === '',
  );
  if (constructor === undefined) {
    return null;
  }
  const plan: ConstructArg[] = [];
  const options: HookOption[] = [];
  for (const param of constructor.params) {
    if (!param.required) {
      continue;
    }
    if (param.type.kind === 'named') {
      const supplied = supplierFor(
        api,
        { name: param.name, typeName: param.type.name },
        overrides,
      );
      if (supplied === null) {
        return null;
      }
      plan.push(supplied);
      if (supplied.kind === 'supplierFirst') {
        for (const filter of supplied.filters) {
          options.push({
            name: filter.optionName,
            enumName: filter.enumName,
            values:
              api.enums.find((candidate) => candidate.name === filter.enumName)
                ?.values ?? [],
            defaultMember: null,
          });
        }
      }
      continue;
    }
    if (param.type.kind === 'enum') {
      const enumName = param.type.name;
      const member = overrides?.enumDefaults[enumName];
      if (member === undefined) {
        return null;
      }
      const optionName = overrides?.optionNames?.[param.name] ?? param.name;
      plan.push({ kind: 'enumDefault', enumName, member, optionName });
      options.push({
        name: optionName,
        enumName,
        values:
          api.enums.find((candidate) => candidate.name === enumName)?.values ??
          [],
        defaultMember: member,
      });
      continue;
    }
    return null;
  }
  return { plan, options };
};

/**
 * A platform's own implementation of a federated plugin.
 *
 * Flutter's federated packages register these with the framework and app code
 * never names one — they extend `PlatformInterface`, which is what says so
 * without knowing any package's naming.
 */
export const isPlatformImplementation = (entity: PluginClass): boolean =>
  entity.supertypes.includes('PlatformInterface');

export const deriveHooks = (
  api: PluginApi,
  overrides: Record<string, HookOverrides> | undefined,
): DerivedHook[] =>
  api.classes.flatMap((entity): DerivedHook[] => {
    if (isPlatformImplementation(entity)) {
      return [];
    }
    const hookName = `use${entity.name
      .replace(/^Flutter/, '')
      .replace(/Controller$/, '')}`;
    const dartImport = `package:${api.package}/${api.package}.dart`;

    // A package that exposes its own singleton means that one to be used.
    const instance = api.instances.find(
      (candidate) => candidate.type === entity.name,
    );
    if (instance !== undefined) {
      return [
        {
          hookName,
          className: entity.name,
          dartImport,
          acquisition: {
            kind: 'topLevelInstance' as const,
            instanceName: instance.name,
          },
          construct: [],
          managed: [],
          options: [],
          listener: listenerOf(api, entity),
        },
      ];
    }

    const service = serviceConstructor(api, entity);
    if (service !== null) {
      return [
        {
          hookName,
          className: entity.name,
          dartImport,
          acquisition: {
            kind: 'constField' as const,
            isConst: service.isConst,
          },
          construct: [],
          managed: [],
          options: [],
          listener: listenerOf(api, entity),
        },
      ];
    }

    const factory = staticFactoryOf(entity);
    if (factory !== null) {
      return [
        {
          hookName,
          className: entity.name,
          dartImport,
          acquisition: { kind: 'staticFactory' as const, method: factory },
          construct: [],
          managed: [],
          options: [],
          listener: listenerOf(api, entity),
        },
      ];
    }

    if (!hasLifecycle(entity)) {
      return [];
    }
    const derived = constructPlan(api, entity, overrides?.[hookName]);
    if (derived === null) {
      return [];
    }
    return [
      {
        hookName,
        className: entity.name,
        dartImport,
        acquisition: { kind: 'constructor' as const },
        construct: derived.plan,
        managed: ['initialize', 'dispose'],
        options: derived.options,
        listener: listenerOf(api, entity),
      },
    ];
  });
