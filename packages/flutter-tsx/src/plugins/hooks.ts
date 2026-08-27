import type { TypeNode } from '../api/model';
import type { PluginApi, PluginClass } from './api';

export type ConstructArg =
  | { kind: 'supplierFirst'; functionName: string; paramType: string }
  | { kind: 'enumDefault'; enumName: string; member: string };

export interface DerivedHook {
  hookName: string;
  className: string;
  dartImport: string;
  construct: ConstructArg[];
  managed: string[];
}

export interface HookOverrides {
  enumDefaults: Record<string, string>;
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

const constructPlan = (
  api: PluginApi,
  entity: PluginClass,
  overrides: HookOverrides | undefined,
): ConstructArg[] | null => {
  const constructor = entity.constructors.find(
    (candidate) => candidate.name === '',
  );
  if (constructor === undefined) {
    return null;
  }
  const plan: ConstructArg[] = [];
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
      const member = overrides?.enumDefaults[param.type.name];
      if (member === undefined) {
        return null;
      }
      plan.push({
        kind: 'enumDefault',
        enumName: param.type.name,
        member,
      });
      continue;
    }
    return null;
  }
  return plan;
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
    const construct = constructPlan(api, entity, overrides?.[hookName]);
    if (construct === null) {
      return [];
    }
    return [
      {
        hookName,
        className: entity.name,
        dartImport: `package:${api.package}/${api.package}.dart`,
        construct,
        managed: ['initialize', 'dispose'],
      },
    ];
  });
