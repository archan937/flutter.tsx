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
    required this.requiredOneOf,
    required this.params,
  });

  final String name;
  final String doc;
  final bool isConst;
  final bool paramMemberAsserts;

  /// Groups of parameters where an assert demands at least one be supplied —
  /// a requirement the type system cannot express (every member is optional).
  final List<List<String>> requiredOneOf;
  final List<ParamModel> params;

  Map<String, Object?> toJson() => {
    'name': name,
    'doc': doc,
    'const': isConst,
    'paramMemberAsserts': paramMemberAsserts,
    'requiredOneOf': requiredOneOf,
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

class FieldModel {
  const FieldModel({required this.name, required this.doc, required this.type});

  final String name;
  final String doc;
  final TypeNode type;

  Map<String, Object?> toJson() => {
    'name': name,
    'doc': doc,
    'type': type.toJson(),
  };
}

class PluginClass {
  const PluginClass({
    required this.name,
    required this.doc,
    required this.supertypes,
    required this.constructors,
    required this.fields,
    required this.methods,
    required this.constants,
  });

  final String name;
  final String doc;

  /// What it extends and implements, so a class that is a Widget is known to
  /// be one — `CameraPreview` is rendered, not called.
  final List<String> supertypes;
  final List<ConstructorModel> constructors;
  final List<FieldModel> fields;
  final List<MethodModel> methods;
  final List<ConstantModel> constants;

  Map<String, Object?> toJson() => {
    'name': name,
    'doc': doc,
    'supertypes': supertypes,
    'constructors': constructors
        .map((constructor) => constructor.toJson())
        .toList(),
    'fields': fields.map((field) => field.toJson()).toList(),
    'methods': methods.map((method) => method.toJson()).toList(),
    'constants': constants.map((constant) => constant.toJson()).toList(),
  };
}

/// What a host app must declare on Android: the permissions the plugin's own
/// manifest contributes (Gradle merges these) plus the `<queries>` schemes
/// its example app declares, which merging cannot supply. A null source means
/// the artifact was not found — never the same as "declares none".
class AndroidPermissions {
  const AndroidPermissions({
    required this.manifestSource,
    required this.permissions,
    required this.exampleSource,
    required this.querySchemes,
  });

  final String? manifestSource;
  final List<String> permissions;
  final String? exampleSource;
  final List<String> querySchemes;

  Map<String, Object?> toJson() => {
    'manifestSource': manifestSource,
    'permissions': permissions,
    'exampleSource': exampleSource,
    'querySchemes': querySchemes,
  };
}

/// What a host app must declare on iOS, read from the plugin's example app:
/// usage-description keys (only the keys are derivable — the strings are
/// app-specific copy) and `LSApplicationQueriesSchemes` entries.
class IosPermissions {
  const IosPermissions({
    required this.exampleSource,
    required this.usageDescriptionKeys,
    required this.querySchemes,
  });

  final String? exampleSource;
  final List<String> usageDescriptionKeys;
  final List<String> querySchemes;

  Map<String, Object?> toJson() => {
    'exampleSource': exampleSource,
    'usageDescriptionKeys': usageDescriptionKeys,
    'querySchemes': querySchemes,
  };
}

class PluginPermissions {
  const PluginPermissions({required this.android, required this.ios});

  final AndroidPermissions android;
  final IosPermissions ios;

  Map<String, Object?> toJson() => {
    'android': android.toJson(),
    'ios': ios.toJson(),
  };
}

/// A top-level instance a plugin exposes: `final trayManager = ...`.
class InstanceModel {
  const InstanceModel({required this.name, required this.type});

  final String name;
  final String type;

  Map<String, Object?> toJson() => {'name': name, 'type': type};
}

class PluginApi {
  const PluginApi({
    required this.package,
    required this.version,
    required this.classes,
    required this.enums,
    required this.functions,
    required this.instances,
    required this.permissions,
  });

  final String package;
  final String version;
  final List<PluginClass> classes;
  final List<EnumEntity> enums;
  final List<FunctionModel> functions;

  /// Top-level singletons the package exposes, e.g. `trayManager`.
  final List<InstanceModel> instances;
  final PluginPermissions permissions;
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
    required this.fields,
    required this.statics,
    required this.staticGetters,
    required this.methods,
  });

  final List<String> supertypes;
  final List<ConstructorModel> constructors;
  final List<ConstantModel> constants;

  /// Public instance fields and getters, so a value of this type can be read.
  final List<FieldModel> fields;

  /// Static methods: `MediaQuery.of(context)`, `View.of(context)`. These are
  /// how the framework hands over values nothing constructs.
  final List<MethodModel> statics;

  /// Static getters, which are the same thing without arguments.
  final List<FieldModel> staticGetters;

  /// What a value of this type answers to: `scroll.jumpTo(0)`. Owning a
  /// controller is pointless without them.
  final List<MethodModel> methods;

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
    'fields': fields.map((field) => field.toJson()).toList(),
    if (statics.isNotEmpty)
      'statics': statics.map((method) => method.toJson()).toList(),
    if (staticGetters.isNotEmpty)
      'staticGetters': staticGetters.map((getter) => getter.toJson()).toList(),
    if (methods.isNotEmpty)
      'methods': methods.map((method) => method.toJson()).toList(),
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
    required super.fields,
    required super.statics,
    required super.staticGetters,
    required super.methods,
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
    required super.fields,
    required super.statics,
    required super.staticGetters,
    required super.methods,
    required this.disposable,
    required this.typeParams,
    required this.supertypeBindings,
    required this.isAbstract,
  });

  /// Whether a public `dispose()` is part of this class's surface.
  ///
  /// A component that owns a value of this type has to release it, and the
  /// name alone does not say: `FocusNode` has to be disposed, `LayerLink`
  /// has nothing to release.
  final bool disposable;

  /// The names this class is generic over: the `T` of a `ValueNotifier<T>`.
  final List<String> typeParams;

  /// What it hands each generic supertype: `CustomClipper<Path>` for a
  /// `ShapeBorderClipper`, which is what makes it usable as one.
  final Map<String, List<TypeNode>> supertypeBindings;

  /// Whether the class is abstract, and so cannot be built at all: only a
  /// concrete subclass of it can be.
  final bool isAbstract;

  @override
  String get kind => 'class';

  @override
  Map<String, Object?> toJson() => {
    ...super.toJson(),
    'disposable': disposable,
    if (isAbstract) 'abstract': true,
    if (typeParams.isNotEmpty) 'typeParams': typeParams,
    if (supertypeBindings.isNotEmpty)
      'supertypeBindings': {
        for (final entry in supertypeBindings.entries)
          entry.key: entry.value.map((node) => node.toJson()).toList(),
      },
  };
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
