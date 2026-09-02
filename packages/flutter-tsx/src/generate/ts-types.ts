import type { FunctionParam, TypeNode } from '../api/model';
import { writtenParamName } from './signature';

const SCALAR_TS_TYPES: Record<string, string> = {
  String: 'string',
  bool: 'boolean',
  int: 'number',
  double: 'number',
  num: 'number',
};

const needsParentheses = (rendered: string): boolean =>
  rendered.includes(' | ') || rendered.includes('=>');

const wrapped = (node: TypeNode): string => {
  const rendered = tsTypeOf(node);
  return needsParentheses(rendered) ? `(${rendered})` : rendered;
};

const functionParam = (param: FunctionParam, index: number): string => {
  const name = writtenParamName(param.name === '' ? `arg${index}` : param.name);
  const optional = param.required ? '' : '?';
  return `${name}${optional}: ${tsTypeOf(param.type)}`;
};

const mapType = (key: TypeNode, value: TypeNode): string => {
  if (key.kind === 'scalar' && key.name === 'String') {
    return `Record<string, ${tsTypeOf(value)}>`;
  }
  if (key.kind === 'scalar' && key.name !== 'bool') {
    return `Record<number, ${tsTypeOf(value)}>`;
  }
  // A widget reads the map it is handed; `ReadonlyMap` says so, and unlike
  // `Map` it accepts a map of narrower keys and values — so the entries need
  // no type arguments spelled out at the call site.
  return `ReadonlyMap<${tsTypeOf(key)}, ${tsTypeOf(value)}>`;
};

/** `FutureOr<T>` — Dart accepts either, and so does the declaration. */
const EITHER_TYPE = 'FutureOr';

export const tsTypeOf = (node: TypeNode): string => {
  switch (node.kind) {
    case 'widget':
      return 'FlutterElement';
    case 'void':
      return 'void';
    // What a generic class is built for is only known where it is named, so
    // at the declaration it is as open as the class is.
    case 'unknown':
    case 'typeVar':
      return 'unknown';
    case 'scalar':
      return SCALAR_TS_TYPES[node.name] ?? 'unknown';
    case 'named': {
      const [either] = node.name === EITHER_TYPE ? (node.args ?? []) : [];
      if (either !== undefined) {
        const held = tsTypeOf(either);
        return `${held} | Promise<${held}>`;
      }
      return node.name;
    }
    case 'enum':
      return node.name;
    case 'nullable': {
      const inner = tsTypeOf(node.inner);
      return inner.includes('=>') ? `(${inner}) | null` : `${inner} | null`;
    }
    case 'list':
    case 'set':
      return `${wrapped(node.item)}[]`;
    case 'map':
      return mapType(node.key, node.value);
    case 'future':
      return `Promise<${tsTypeOf(node.item)}>`;
    // A Dart Stream is many values over time; TSX only ever hands it to
    // useStream, and AsyncIterable carries the item type correctly.
    case 'stream':
      return `AsyncIterable<${tsTypeOf(node.item)}>`;
    case 'function':
      return `(${node.params.map(functionParam).join(', ')}) => ${tsTypeOf(
        node.returnType,
      )}`;
  }
};
