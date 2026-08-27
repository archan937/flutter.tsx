import type { ParamModel, TypeNode } from '../api/model';
import { tsTypeOf } from '../generate/ts-types';
import type { PluginApi, PluginMethod } from './api';
import type { DerivedHook } from './hooks';

interface TypeRefs {
  named: Set<string>;
  enums: Set<string>;
  usesWidget: boolean;
}

const collectRefs = (node: TypeNode, refs: TypeRefs): void => {
  switch (node.kind) {
    case 'named':
      refs.named.add(node.name);
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

const TS_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const signatureParams = (params: ParamModel[]): string => {
  const positional = params
    .filter((param) => !param.named)
    .map((param) => {
      const optional = param.required ? '' : '?';
      return `${param.name}${optional}: ${tsTypeOf(param.type)}`;
    });
  const named = params.filter((param) => param.named);
  if (named.length === 0) {
    return positional.join(', ');
  }
  const members = named
    .map((param) => {
      const optional = param.required ? '' : '?';
      return `${param.name}${optional}: ${tsTypeOf(param.type)}`;
    })
    .join('; ');
  const allNamedOptional = named.every((param) => !param.required);
  return [
    ...positional,
    `options${allNamedOptional ? '?' : ''}: { ${members} }`,
  ].join(', ');
};

const methodLine = (method: PluginMethod): string =>
  `    ${method.name}(${signatureParams(method.params)}): ${tsTypeOf(method.returnType)};`;

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
    lines.push(...tsMethods(entity).map(methodLine));
    blocks.push(
      lines.length === 0
        ? `  export class ${entity.name} {}`
        : `  export class ${entity.name} {\n${lines.join('\n')}\n  }`,
    );
  }

  for (const fn of api.functions) {
    blocks.push(
      `  export const ${fn.name}: (${signatureParams(fn.params)}) => ${tsTypeOf(fn.returnType)};`,
    );
  }

  for (const hook of hooks) {
    const managed = hook.managed.map((name) => `'${name}'`).join(' | ');
    const optionMembers = hook.options
      .map((option) => `${option.name}?: ${option.enumName}`)
      .join('; ');
    const parameters =
      hook.options.length === 0 ? '' : `options?: { ${optionMembers} }`;
    blocks.push(
      `  export const ${hook.hookName}: (${parameters}) => Omit<${hook.className}, ${managed}>;`,
    );
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
