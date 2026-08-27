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
export const dartTypeOf = (type: TypeNode): string | null => {
  switch (type.kind) {
    case 'scalar':
      return DART_SCALARS[type.name] ?? null;
    case 'enum':
    case 'named':
      return type.name;
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
    default:
      return null;
  }
};
