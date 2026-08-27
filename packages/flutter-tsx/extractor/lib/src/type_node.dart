sealed class TypeNode {
  const TypeNode();

  Map<String, Object?> toJson();
}

class WidgetTypeNode extends TypeNode {
  const WidgetTypeNode();

  @override
  Map<String, Object?> toJson() => {'kind': 'widget'};
}

class VoidTypeNode extends TypeNode {
  const VoidTypeNode();

  @override
  Map<String, Object?> toJson() => {'kind': 'void'};
}

class UnknownTypeNode extends TypeNode {
  const UnknownTypeNode();

  @override
  Map<String, Object?> toJson() => {'kind': 'unknown'};
}

class ScalarTypeNode extends TypeNode {
  const ScalarTypeNode(this.name);

  final String name;

  @override
  Map<String, Object?> toJson() => {'kind': 'scalar', 'name': name};
}

class EnumTypeNode extends TypeNode {
  const EnumTypeNode(this.name);

  final String name;

  @override
  Map<String, Object?> toJson() => {'kind': 'enum', 'name': name};
}

class NamedTypeNode extends TypeNode {
  const NamedTypeNode(this.name);

  final String name;

  @override
  Map<String, Object?> toJson() => {'kind': 'named', 'name': name};
}

class NullableTypeNode extends TypeNode {
  const NullableTypeNode(this.inner);

  final TypeNode inner;

  @override
  Map<String, Object?> toJson() => {
    'kind': 'nullable',
    'inner': inner.toJson(),
  };
}

class ListTypeNode extends TypeNode {
  const ListTypeNode(this.item);

  final TypeNode item;

  @override
  Map<String, Object?> toJson() => {'kind': 'list', 'item': item.toJson()};
}

class SetTypeNode extends TypeNode {
  const SetTypeNode(this.item);

  final TypeNode item;

  @override
  Map<String, Object?> toJson() => {'kind': 'set', 'item': item.toJson()};
}

class MapTypeNode extends TypeNode {
  const MapTypeNode(this.key, this.value);

  final TypeNode key;
  final TypeNode value;

  @override
  Map<String, Object?> toJson() => {
    'kind': 'map',
    'key': key.toJson(),
    'value': value.toJson(),
  };
}

class StreamTypeNode extends TypeNode {
  const StreamTypeNode(this.item);

  final TypeNode item;

  @override
  Map<String, Object?> toJson() => {'kind': 'stream', 'item': item.toJson()};
}

class FutureTypeNode extends TypeNode {
  const FutureTypeNode(this.item);

  final TypeNode item;

  @override
  Map<String, Object?> toJson() => {'kind': 'future', 'item': item.toJson()};
}

class FunctionTypeNode extends TypeNode {
  const FunctionTypeNode({required this.returnType, required this.params});

  final TypeNode returnType;
  final List<FunctionParamNode> params;

  @override
  Map<String, Object?> toJson() => {
    'kind': 'function',
    'returnType': returnType.toJson(),
    'params': params.map((param) => param.toJson()).toList(),
  };
}

class FunctionParamNode {
  const FunctionParamNode({
    required this.name,
    required this.type,
    required this.isNamed,
    required this.isRequired,
  });

  final String name;
  final TypeNode type;
  final bool isNamed;
  final bool isRequired;

  Map<String, Object?> toJson() => {
    'name': name,
    'type': type.toJson(),
    'named': isNamed,
    'required': isRequired,
  };
}
