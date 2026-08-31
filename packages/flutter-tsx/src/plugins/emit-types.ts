import type { ParamModel, TypeNode } from '../api/model';
import { tsTypeOf } from '../generate/ts-types';
import type { PluginApi, PluginMethod } from './api';
import type { DerivedHook, HookEvent } from './hooks';

interface TypeRefs {
  named: Set<string>;
  enums: Set<string>;
  usesWidget: boolean;
}

const collectRefs = (node: TypeNode, refs: TypeRefs): void => {
  switch (node.kind) {
    case 'named':
      if (!CORE_STRING_TYPES.has(node.name)) {
        refs.named.add(node.name);
      }
      break;
    case 'enum':
      refs.enums.add(node.name);
      break;
    case 'widget':
      refs.usesWidget = true;
      break;
    case 'nullable':
      collectRefs(node.inner, refs);
      break;
    case 'list':
    case 'set':
    case 'future':
    case 'stream':
      collectRefs(node.item, refs);
      break;
    case 'map':
      collectRefs(node.key, refs);
      collectRefs(node.value, refs);
      break;
    case 'function':
      collectRefs(node.returnType, refs);
      for (const param of node.params) {
        collectRefs(param.type, refs);
      }
      break;
    default:
      break;
  }
};

// Dart core types with an idiomatic TS spelling: a Uri parameter is a URL
// string in TSX (the compiler wraps it in Uri.parse).
const CORE_STRING_TYPES = new Set(['Uri']);

const withCoreStrings = (node: TypeNode): TypeNode => {
  switch (node.kind) {
    case 'named':
      return CORE_STRING_TYPES.has(node.name)
        ? { kind: 'scalar', name: 'String' }
        : node;
    case 'nullable':
      return { kind: 'nullable', inner: withCoreStrings(node.inner) };
    case 'list':
    case 'set':
    case 'future':
    case 'stream':
      return { ...node, item: withCoreStrings(node.item) };
    case 'map':
      return {
        kind: 'map',
        key: withCoreStrings(node.key),
        value: withCoreStrings(node.value),
      };
    case 'function':
      return {
        ...node,
        returnType: withCoreStrings(node.returnType),
        params: node.params.map((param) => ({
          ...param,
          type: withCoreStrings(param.type),
        })),
      };
    default:
      return node;
  }
};

const TS_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Dart happily names a function `delete`; TypeScript cannot declare a const
// by that name, but it can export one under the reserved alias — so the name
// stays reachable through `import { delete as httpDelete }`.
const TS_RESERVED = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
]);

/**
 * The type a top-level plugin function is declared with — the one the IDE
 * shows and the one the API reference documents, from a single source.
 */
export const functionSignature = (fn: PluginMethod): string =>
  `(${signatureParams(fn.params)}) => ${tsTypeOf(withCoreStrings(fn.returnType))}`;

const reservedFunction = (fn: PluginMethod): string => {
  const signature = functionSignature(fn);
  if (!TS_RESERVED.has(fn.name)) {
    return `  export const ${fn.name}: ${signature};`;
  }
  return (
    `  const ${fn.name}_: ${signature};\n` +
    `  export { ${fn.name}_ as ${fn.name} };`
  );
};

const signatureParams = (params: ParamModel[]): string => {
  const positional = params
    .filter((param) => !param.named)
    .map((param) => {
      const optional = param.required ? '' : '?';
      return `${param.name}${optional}: ${tsTypeOf(withCoreStrings(param.type))}`;
    });
  const named = params.filter((param) => param.named);
  if (named.length === 0) {
    return positional.join(', ');
  }
  const members = named
    .map((param) => {
      const optional = param.required ? '' : '?';
      return `${param.name}${optional}: ${tsTypeOf(withCoreStrings(param.type))}`;
    })
    .join('; ');
  const allNamedOptional = named.every((param) => !param.required);
  return [
    ...positional,
    `options${allNamedOptional ? '?' : ''}: { ${members} }`,
  ].join(', ');
};

const methodLine = (method: PluginMethod): string => {
  const modifier = method.isStatic ? 'static ' : '';
  return `    ${modifier}${method.name}(${signatureParams(method.params)}): ${tsTypeOf(withCoreStrings(method.returnType))};`;
};

/**
 * The type a hook is declared with — the one the IDE shows and the one the
 * API reference documents, so the two can never disagree. Options are named
 * after the plugin's own fields; the managed lifecycle calls are `Omit`ted
 * because the generated widget makes them, not the developer.
 */
/** An event's values, as the callback that receives them declares them. */
const eventParams = (event: HookEvent): string =>
  event.params
    .map((param) => `${param.name}: ${tsTypeOf(withCoreStrings(param.type))}`)
    .join(', ');

export const hookSignature = (hook: DerivedHook): string => {
  const members = [
    ...hook.options.map((option) => `${option.name}?: ${option.enumName}`),
    // A listener's callbacks are options too: writing one is how a component
    // says it wants that event, and the widget is registered because it did.
    ...(hook.listener?.events ?? []).map(
      (event) => `${event.name}?: (${eventParams(event)}) => void`,
    ),
  ];
  const optionMembers = members.join('; ');
  const parameters =
    members.length === 0 ? '' : `options?: { ${optionMembers} }`;
  const managed = hook.managed.map((name) => `'${name}'`).join(' | ');
  const handle =
    hook.managed.length === 0
      ? hook.className
      : `Omit<${hook.className}, ${managed}>`;
  return `(${parameters}) => ${handle}`;
};

export const emitPluginDeclaration = (
  api: PluginApi,
  hooks: DerivedHook[],
): string => {
  const declaredNames = new Set([
    ...api.classes.map((entity) => entity.name),
    ...api.enums.map((entity) => entity.name),
  ]);

  const refs: TypeRefs = {
    named: new Set(),
    enums: new Set(),
    usesWidget: false,
  };
  const tsMethods = (entity: PluginApi['classes'][number]): PluginMethod[] =>
    entity.methods.filter((method) => TS_IDENTIFIER.test(method.name));
  for (const entity of api.classes) {
    for (const constructor of entity.constructors) {
      for (const param of constructor.params) {
        collectRefs(param.type, refs);
      }
    }
    for (const field of entity.fields) {
      collectRefs(field.type, refs);
    }
    for (const method of tsMethods(entity)) {
      collectRefs(method.returnType, refs);
      for (const param of method.params) {
        collectRefs(param.type, refs);
      }
    }
  }
  for (const fn of api.functions) {
    collectRefs(fn.returnType, refs);
    for (const param of fn.params) {
      collectRefs(param.type, refs);
    }
  }
  const externals = [...refs.named]
    .filter((name) => !declaredNames.has(name))
    .sort((first, second) => first.localeCompare(second));
  const sdkImports = [
    ...[...refs.enums].filter((name) => !declaredNames.has(name)),
    ...(refs.usesWidget ? ['FlutterElement'] : []),
  ].sort((first, second) => first.localeCompare(second));

  const blocks: string[] = [];
  if (sdkImports.length > 0) {
    blocks.push(
      `  import type { ${sdkImports.join(', ')} } from 'flutter-tsx';`,
    );
  }

  for (const entity of api.enums) {
    const union = entity.values.map((value) => `'${value}'`).join(' | ');
    blocks.push(`  export type ${entity.name} = ${union};`);
  }

  for (const name of externals) {
    blocks.push(
      `  export interface ${name} {\n    readonly __external: '${name}';\n  }`,
    );
  }

  for (const entity of api.classes) {
    const lines: string[] = [];
    const constructor = entity.constructors.find(
      (candidate) => candidate.name === '',
    );
    if (constructor !== undefined) {
      lines.push(`    constructor(${signatureParams(constructor.params)});`);
    }
    lines.push(
      ...entity.fields
        .filter((field) => TS_IDENTIFIER.test(field.name))
        .map(
          (field) =>
            `    readonly ${field.name}: ${tsTypeOf(withCoreStrings(field.type))};`,
        ),
    );
    lines.push(...tsMethods(entity).map(methodLine));
    blocks.push(
      lines.length === 0
        ? `  export class ${entity.name} {}`
        : `  export class ${entity.name} {\n${lines.join('\n')}\n  }`,
    );
  }

  for (const fn of api.functions) {
    blocks.push(reservedFunction(fn));
  }

  for (const hook of hooks) {
    blocks.push(`  export const ${hook.hookName}: ${hookSignature(hook)};`);
  }

  return (
    `// GENERATED by \`bun run generate:plugin ${api.package}\` from ` +
    `ref/plugins/${api.package}.json — do not edit.\n` +
    `// ${api.package} ${api.version}\n\n` +
    `declare module 'plugin:${api.package}' {\n` +
    `${blocks.join('\n\n')}\n` +
    `}\n`
  );
};
