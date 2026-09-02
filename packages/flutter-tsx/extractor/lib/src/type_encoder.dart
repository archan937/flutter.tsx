import 'package:analyzer/dart/element/element.dart';
import 'package:analyzer/dart/element/nullability_suffix.dart';
import 'package:analyzer/dart/element/type.dart';

import 'type_node.dart';

const _scalarNames = {'String', 'bool', 'int', 'double', 'num'};

TypeNode encodeType(DartType type) {
  if (type.nullabilitySuffix == NullabilitySuffix.question) {
    return NullableTypeNode(_encodeNonNullable(type));
  }
  return _encodeNonNullable(type);
}

TypeNode _encodeNonNullable(DartType type) {
  if (type is VoidType) {
    return const VoidTypeNode();
  }
  if (type is FunctionType) {
    return _encodeFunction(type);
  }
  if (type is InterfaceType) {
    return _encodeInterface(type);
  }
  if (type is TypeParameterType) {
    final name = type.element.name ?? '';
    return name.isEmpty ? const UnknownTypeNode() : TypeVarTypeNode(name);
  }
  return const UnknownTypeNode();
}

TypeNode _encodeInterface(InterfaceType type) {
  final name = type.element.name ?? '';
  if (name.isEmpty) {
    return const UnknownTypeNode();
  }
  if (name == 'Widget') {
    return const WidgetTypeNode();
  }
  if (type.element is EnumElement) {
    return EnumTypeNode(name);
  }
  if ((name == 'List' || name == 'Iterable') && type.typeArguments.isNotEmpty) {
    return ListTypeNode(encodeType(type.typeArguments.first));
  }
  if (name == 'Set' && type.typeArguments.isNotEmpty) {
    return SetTypeNode(encodeType(type.typeArguments.first));
  }
  if (name == 'Map' && type.typeArguments.length == 2) {
    return MapTypeNode(
      encodeType(type.typeArguments[0]),
      encodeType(type.typeArguments[1]),
    );
  }
  if (name == 'Future' && type.typeArguments.isNotEmpty) {
    return FutureTypeNode(encodeType(type.typeArguments.first));
  }
  if (name == 'Stream' && type.typeArguments.isNotEmpty) {
    return StreamTypeNode(encodeType(type.typeArguments.first));
  }
  if (_scalarNames.contains(name)) {
    return ScalarTypeNode(name);
  }
  return NamedTypeNode(name, type.typeArguments.map(encodeType).toList());
}

FunctionTypeNode _encodeFunction(FunctionType type) {
  final params = type.formalParameters
      .map(
        (param) => FunctionParamNode(
          name: param.name ?? '',
          type: encodeType(param.type),
          isNamed: param.isNamed,
          isRequired: param.isRequired,
        ),
      )
      .toList();
  return FunctionTypeNode(
    returnType: encodeType(type.returnType),
    params: params,
  );
}
