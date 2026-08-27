import 'type_node.dart';

class SdkMeta {
  const SdkMeta({
    required this.frameworkVersion,
    required this.dartSdkVersion,
    required this.frameworkRevision,
  });

  final String frameworkVersion;
  final String dartSdkVersion;
  final String frameworkRevision;

  Map<String, Object?> toJson() => {
    'frameworkVersion': frameworkVersion,
    'dartSdkVersion': dartSdkVersion,
    'frameworkRevision': frameworkRevision,
  };
}

class ParamModel {
  const ParamModel({
    required this.name,
    required this.type,
    required this.display,
    required this.isNamed,
    required this.isRequired,
    required this.defaultValue,
    required this.doc,
    required this.isDeprecated,
  });

  final String name;
  final TypeNode type;
  final String display;
  final bool isNamed;
  final bool isRequired;
  final String? defaultValue;
  final String doc;
  final bool isDeprecated;

  Map<String, Object?> toJson() => {
    'name': name,
    'type': type.toJson(),
    'display': display,
    'named': isNamed,
    'required': isRequired,
    'defaultValue': defaultValue,
    'doc': doc,
    'deprecated': isDeprecated,
  };
}

class ConstantModel {
  const ConstantModel({
    required this.name,
    required this.type,
    required this.display,
    required this.doc,
  });

  final String name;
  final TypeNode type;
  final String display;
  final String doc;

  Map<String, Object?> toJson() => {
    'name': name,
    'type': type.toJson(),
    'display': display,
    'doc': doc,
  };
}

class ConstructorModel {
  const ConstructorModel({
    required this.name,
    required this.doc,
    required this.isConst,
    required this.paramMemberAsserts,
    required this.params,
  });

  final String name;
  final String doc;
  final bool isConst;
  final bool paramMemberAsserts;
  final List<ParamModel> params;

  Map<String, Object?> toJson() => {
    'name': name,
    'doc': doc,
    'const': isConst,
    'paramMemberAsserts': paramMemberAsserts,
    'params': params.map((param) => param.toJson()).toList(),
  };
}

class MethodModel {
  const MethodModel({
    required this.name,
    required this.doc,
    required this.isStatic,
    required this.returnType,
    required this.params,
  });

  final String name;
  final String doc;
  final bool isStatic;
  final TypeNode returnType;
  final List<ParamModel> params;

  Map<String, Object?> toJson() => {
    'name': name,
    'doc': doc,
    'static': isStatic,
    'returnType': returnType.toJson(),
    'params': params.map((param) => param.toJson()).toList(),
  };
}

class FunctionModel {
  const FunctionModel({
    required this.name,
    required this.doc,
    required this.returnType,
    required this.params,
  });

  final String name;
  final String doc;
  final TypeNode returnType;
  final List<ParamModel> params;

  Map<String, Object?> toJson() => {
    'name': name,
    'doc': doc,
    'returnType': returnType.toJson(),
    'params': params.map((param) => param.toJson()).toList(),
  };
}

class PluginClass {
  const PluginClass({
    required this.name,
    required this.doc,
    required this.constructors,
    required this.methods,
    required this.constants,
  });

  final String name;
  final String doc;
  final List<ConstructorModel> constructors;
  final List<MethodModel> methods;
  final List<ConstantModel> constants;

  Map<String, Object?> toJson() => {
    'name': name,
    'doc': doc,
    'constructors': constructors
        .map((constructor) => constructor.toJson())
        .toList(),
    'methods': methods.map((method) => method.toJson()).toList(),
    'constants': constants.map((constant) => constant.toJson()).toList(),
  };
}

class PluginApi {
  const PluginApi({
    required this.package,
    required this.version,
    required this.classes,
    required this.enums,
    required this.functions,
  });

  final String package;
  final String version;
  final List<PluginClass> classes;
  final List<EnumEntity> enums;
  final List<FunctionModel> functions;
}

sealed class EntityModel {
  const EntityModel({
    required this.name,
    required this.library,
    required this.doc,
  });

  final String name;
  final String library;
  final String doc;

  String get kind;

  Map<String, Object?> toJson();
}

abstract class ConstructedEntity extends EntityModel {
  const ConstructedEntity({
    required super.name,
    required super.library,
    required super.doc,
    required this.supertypes,
    required this.constructors,
    required this.constants,
  });

  final List<String> supertypes;
  final List<ConstructorModel> constructors;
  final List<ConstantModel> constants;

  @override
  Map<String, Object?> toJson() => {
    'kind': kind,
    'name': name,
    'library': library,
    'doc': doc,
    'supertypes': supertypes,
    'constructors': constructors
        .map((constructor) => constructor.toJson())
        .toList(),
    'constants': constants.map((constant) => constant.toJson()).toList(),
  };
}

class WidgetEntity extends ConstructedEntity {
  const WidgetEntity({
    required super.name,
    required super.library,
    required super.doc,
    required super.supertypes,
    required super.constructors,
    required super.constants,
  });

  @override
  String get kind => 'widget';
}

class ClassEntity extends ConstructedEntity {
  const ClassEntity({
    required super.name,
    required super.library,
    required super.doc,
    required super.supertypes,
    required super.constructors,
    required super.constants,
  });

  @override
  String get kind => 'class';
}

class EnumValueModel {
  const EnumValueModel({required this.name, required this.doc});

  final String name;
  final String doc;

  Map<String, Object?> toJson() => {'name': name, 'doc': doc};
}

class EnumEntity extends EntityModel {
  const EnumEntity({
    required super.name,
    required super.library,
    required super.doc,
    required this.values,
  });

  final List<EnumValueModel> values;

  @override
  String get kind => 'enum';

  @override
  Map<String, Object?> toJson() => {
    'kind': kind,
    'name': name,
    'library': library,
    'doc': doc,
    'values': values.map((value) => value.toJson()).toList(),
  };
}

class ApiSnapshot {
  const ApiSnapshot({
    required this.meta,
    required this.hierarchy,
    required this.exports,
    required this.entities,
  });

  final SdkMeta meta;
  final Map<String, List<String>> hierarchy;
  final Map<String, List<String>> exports;
  final List<EntityModel> entities;
}
