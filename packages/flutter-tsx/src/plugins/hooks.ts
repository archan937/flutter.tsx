import type { TypeNode } from '../api/model';
import type { PluginApi, PluginClass } from './api';

export type ConstructArg =
  | { kind: 'supplierFirst'; functionName: string; paramType: string }
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
  defaultMember: string;
}

export interface DerivedHook {
  hookName: string;
  className: string;
  dartImport: string;
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

const supplierFor = (
  api: PluginApi,
  paramType: string,
): ConstructArg | null => {
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
        paramType,
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
      const supplied = supplierFor(api, param.type.name);
      if (supplied === null) {
        return null;
      }
      plan.push(supplied);
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
  api.classes.flatMap((entity) => {
    if (!hasLifecycle(entity)) {
      return [];
    }
    const hookName = `use${entity.name.replace(/Controller$/, '')}`;
    const derived = constructPlan(api, entity, overrides?.[hookName]);
    if (derived === null) {
      return [];
    }
    return [
      {
        hookName,
        className: entity.name,
        dartImport: `package:${api.package}/${api.package}.dart`,
        construct: derived.plan,
        managed: ['initialize', 'dispose'],
        options: derived.options,
      },
    ];
  });
