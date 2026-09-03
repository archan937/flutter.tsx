import type { TypeNode } from '../api/model';

const DART_SCALARS: Record<string, string> = {
  String: 'String',
  bool: 'bool',
  int: 'int',
  double: 'double',
  num: 'num',
};

// TypeNode -> Dart source type, for the generic argument of a FutureBuilder
// and the type of the value it resolves to.
/**
 * A Dart type as a return position writes it.
 *
 * `void` is a type there and nowhere else, and a `Future<void>` carries it,
 * so both are named here rather than in the type printer every other
 * position shares.
 */
export const returnDartTypeOf = (type: TypeNode): string | null => {
  if (type.kind === 'void') {
    return 'void';
  }
  if (type.kind === 'future') {
    const item = returnDartTypeOf(type.item);
    return item === null ? null : `Future<${item}>`;
  }
  return dartTypeOf(type);
};

export const dartTypeOf = (type: TypeNode): string | null => {
  switch (type.kind) {
    case 'scalar':
      return DART_SCALARS[type.name] ?? null;
    case 'enum':
      return type.name;
    // What a type is written with is part of it: a
    // `Factory<OneSequenceGestureRecognizer>` is not a `Factory`.
    case 'named': {
      const args = (type.args ?? []).map(dartTypeOf);
      if (args.length === 0) {
        return type.name;
      }
      return args.some((arg) => arg === null)
        ? type.name
        : `${type.name}<${args.join(', ')}>`;
    }
    case 'widget':
      return 'Widget';
    case 'nullable': {
      const inner = dartTypeOf(type.inner);
      return inner === null ? null : `${inner}?`;
    }
    case 'list': {
      const item = dartTypeOf(type.item);
      return item === null ? null : `List<${item}>`;
    }
    case 'set': {
      const item = dartTypeOf(type.item);
      return item === null ? null : `Set<${item}>`;
    }
    case 'future': {
      const item = dartTypeOf(type.item);
      return item === null ? null : `Future<${item}>`;
    }
    case 'stream': {
      const item = dartTypeOf(type.item);
      return item === null ? null : `Stream<${item}>`;
    }
    case 'map': {
      const key = dartTypeOf(type.key);
      const value = dartTypeOf(type.value);
      return key === null || value === null ? null : `Map<${key}, ${value}>`;
    }
    // A callback is a type in Dart as much as in TypeScript:
    // `void Function(PaintingContext, Offset)` is what a painter is handed,
    // and a member declaring one has to say so.
    case 'function': {
      const returned = returnDartTypeOf(type.returnType);
      const params = type.params.map((param) => dartTypeOf(param.type));
      return returned === null || params.some((param) => param === null)
        ? null
        : `${returned} Function(${params.join(', ')})`;
    }
    // A void, an unknown and a type variable are not types a value is
    // written with: each is named where it does mean something.
    case 'void':
    case 'unknown':
    case 'typeVar':
      return null;
  }
};
