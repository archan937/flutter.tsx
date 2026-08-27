import type { TypeNode } from '../api/model';
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
  | { kind: 'constField'; isConst: boolean };

export interface DerivedHook {
  hookName: string;
  className: string;
  dartImport: string;
  acquisition: HookAcquisition;
  construct: ConstructArg[];
  managed: string[];
  options: HookOption[];
}

export interface HookOverrides {
  enumDefaults: Record<string, string>;
  optionNames?: Record<string, string>;
}

const isFutureVoid = (type: TypeNode): boolean =>
  type.kind === 'future' && type.item.kind === 'void';

const pascalCase = (packageName: string): string =>
  packageName
    .split('_')
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('');

const serviceConstructor = (
  api: PluginApi,
  entity: PluginClass,
): { isConst: boolean } | null => {
  if (entity.name !== pascalCase(api.package)) {
    return null;
  }
  const constructor = entity.constructors.find(
    (candidate) => candidate.name === '',
  );
  const hasInstanceMethods = entity.methods.some((method) => !method.isStatic);
  if (
    constructor === undefined ||
    !hasInstanceMethods ||
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

export const deriveHooks = (
  api: PluginApi,
  overrides: Record<string, HookOverrides> | undefined,
): DerivedHook[] =>
  api.classes.flatMap((entity): DerivedHook[] => {
    const hookName = `use${entity.name
      .replace(/^Flutter/, '')
      .replace(/Controller$/, '')}`;
    const dartImport = `package:${api.package}/${api.package}.dart`;

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
      },
    ];
  });
