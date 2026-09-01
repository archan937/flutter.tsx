import type { TypeNode } from '../api/model';
import type { PluginApi, PluginClass } from './api';
import {
  type DerivedHook,
  deriveHooks,
  isPlatformImplementation,
} from './hooks';

/**
 * How a class a package exports can be reached from TSX.
 *
 * Extracting something a developer cannot use is the shape of a facade: the
 * API reference lists it, the typings declare it, and nothing compiles. The
 * routes below are the complete set the compiler really has, so every class
 * lands on exactly one — and the two that are not values a developer holds,
 * `base` and `internal`, are the two the typings must not advertise.
 */
export type Reach =
  /** `useCamera()` — a hook hands the instance over. */
  | 'hook'
  /** A mixin the widget implements to receive the package's events. */
  | 'listener'
  /** Rendered in JSX: `<CameraPreview controller={cam} />`. */
  | 'widget'
  /** Handed back by a reachable call, or read off a reachable value. */
  | 'value'
  /**
   * Built by name: `new MediaType('text', 'plain')`, or the static that makes
   * one — `SharedPreferencesWithCache.create(…)`.
   */
  | 'constructed'
  /**
   * A base class or mixin: it declares no constructor, so no value of it is
   * ever made — what it contributes is reached through the classes that
   * extend it, which are themselves reachable.
   */
  | 'base'
  /** A platform's own implementation, registered by Flutter, never named. */
  | 'internal';

export interface ClassReach {
  name: string;
  reach: Reach;
}

/** Every named type inside a type, however deeply it is wrapped. */
const typeNames = (node: TypeNode): string[] => {
  switch (node.kind) {
    case 'named':
    case 'enum':
      return [node.name];
    case 'nullable':
      return typeNames(node.inner);
    case 'list':
    case 'set':
    case 'future':
    case 'stream':
      return typeNames(node.item);
    case 'map':
      return [...typeNames(node.key), ...typeNames(node.value)];
    case 'function':
      return [
        ...typeNames(node.returnType),
        ...node.params.flatMap((param) => typeNames(param.type)),
      ];
    default:
      return [];
  }
};

/** Everything a hook hands over, and everything reachable from that. */
const valueTypes = (api: PluginApi, hooks: DerivedHook[]): Set<string> => {
  const byName = new Map(api.classes.map((entity) => [entity.name, entity]));
  const reached = new Set<string>();
  const pending = [
    ...hooks.map((hook) => hook.className),
    ...hooks.flatMap((hook) =>
      hook.listener === null ? [] : [hook.listener.className],
    ),
    ...api.functions.flatMap((fn) => [
      ...typeNames(fn.returnType),
      ...fn.params.flatMap((param) => typeNames(param.type)),
    ]),
    ...api.instances.map((instance) => instance.type),
  ];

  while (pending.length > 0) {
    const name = pending.pop();
    if (name === undefined || reached.has(name)) continue;
    reached.add(name);
    const entity = byName.get(name);
    if (entity === undefined) continue;
    for (const method of entity.methods) {
      pending.push(...typeNames(method.returnType));
      for (const param of method.params) pending.push(...typeNames(param.type));
    }
    for (const field of entity.fields) pending.push(...typeNames(field.type));
    for (const constructor of entity.constructors) {
      for (const param of constructor.params) {
        pending.push(...typeNames(param.type));
      }
    }
  }
  return reached;
};

const isWidget = (entity: PluginClass): boolean =>
  entity.supertypes.includes('Widget');

/** Every class the package exports, and how TSX reaches it. */
export const classReach = (
  api: PluginApi,
  overrides: Record<string, Parameters<typeof deriveHooks>[1]> = {},
): ClassReach[] => {
  const hooks = deriveHooks(api, overrides[api.package]);
  const hookClasses = new Set(hooks.map((hook) => hook.className));
  const listenerClasses = new Set(
    hooks.flatMap((hook) =>
      hook.listener === null ? [] : [hook.listener.className],
    ),
  );
  const values = valueTypes(api, hooks);

  return api.classes.map((entity): ClassReach => {
    if (hookClasses.has(entity.name)) {
      return { name: entity.name, reach: 'hook' };
    }
    if (listenerClasses.has(entity.name)) {
      return { name: entity.name, reach: 'listener' };
    }
    if (isWidget(entity)) return { name: entity.name, reach: 'widget' };
    if (isPlatformImplementation(entity)) {
      return { name: entity.name, reach: 'internal' };
    }
    if (values.has(entity.name)) return { name: entity.name, reach: 'value' };
    if (entity.constructors.length > 0 || makesItself(entity)) {
      return { name: entity.name, reach: 'constructed' };
    }
    // Nothing hands one over and nothing can make one: whatever it is called,
    // it is an interface for implementations rather than a value for callers.
    return { name: entity.name, reach: 'base' };
  });
};

/** Whether a static of the class hands back one of itself. */
const makesItself = (entity: PluginClass): boolean =>
  entity.methods.some(
    (method) =>
      method.isStatic && typeNames(method.returnType).includes(entity.name),
  );
