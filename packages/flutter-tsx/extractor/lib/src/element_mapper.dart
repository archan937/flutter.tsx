import 'package:analyzer/dart/element/element.dart';

import 'api_model.dart';
import 'assert_inspector.dart';
import 'type_encoder.dart';
import 'type_node.dart';

EntityModel? mapClass(
  ClassElement classElement,
  String libraryLabel,
  AssertInspector asserts,
) {
  final name = classElement.name ?? '';
  if (name.isEmpty || name.startsWith('_')) {
    return null;
  }

  final constants = _mapConstants(classElement);

  final constructors = _mapConstructors(classElement, asserts);
  final supertypes = publicSupertypeNames(classElement);
  final doc = classElement.documentationComment ?? '';

  // What a value of this type can be read for — `constraints.maxWidth` is
  // only compilable because the field is known here.
  final fields = _mapInstanceFields(classElement);

  // How the framework hands over values nothing constructs.
  final statics = _mapStaticMethods(classElement);
  final staticGetters = _mapStaticGetters(classElement);
  // What a value answers to, which is the reason to hold one.
  final methods = _mapInstanceMethods(classElement);

  // An abstract class is part of the surface as a type — `Action`, a sliver
  // delegate, `Shader` — but never as a component: nothing can build one, so
  // nothing can write it as a tag.
  if (supertypes.contains('Widget') && !classElement.isAbstract) {
    return WidgetEntity(
      name: name,
      library: libraryLabel,
      doc: doc,
      supertypes: supertypes,
      constructors: constructors,
      constants: constants,
      fields: fields,
      statics: statics,
      staticGetters: staticGetters,
      methods: methods,
    );
  }
  // What an app writes itself, rather than builds or is handed.
  final mixin = _mapMixin(classElement, supertypes.toSet());

  return ClassEntity(
    name: name,
    library: libraryLabel,
    doc: doc,
    supertypes: supertypes,
    supertypeBindings: publicSupertypeBindings(classElement),
    constructors: constructors,
    constants: constants,
    fields: fields,
    statics: statics,
    staticGetters: staticGetters,
    methods: methods,
    disposable: _hasPublicDispose(classElement),
    isAbstract: classElement.isAbstract,
    abstractMethods: _mapAbstractMethods(classElement, mixin),
    abstractGetters: _mapAbstractGetters(classElement, mixin),
    mixin: mixin,
    typeParams: classElement.typeParameters
        .map((parameter) => parameter.name ?? '')
        .where((name) => name.isNotEmpty)
        .toList(),
    typeParamBounds: classElement.typeParameters
        .where((parameter) => (parameter.name ?? '').isNotEmpty)
        .map(_boundName)
        .toList(),
  );
}

/// The static methods a class offers, which is how a value with no
/// constructor is still reached: `MediaQuery.of(context)`.
List<MethodModel> _mapStaticMethods(ClassElement classElement) =>
    classElement.methods
        .where(
          (method) =>
              method.isStatic &&
              method.isPublic &&
              (method.name ?? '') != '' &&
              // A member Flutter marks for tests or for subclasses is not
              // part of the API an app writes against.
              !method.metadata.hasVisibleForTesting &&
              !method.metadata.hasProtected,
        )
        .map(
          (method) => MethodModel(
            name: method.name ?? '',
            doc: method.documentationComment ?? '',
            isStatic: true,
            returnType: encodeType(method.returnType),
            params: method.formalParameters
                .map((param) => _mapParam(classElement, param))
                .toList(),
          ),
        )
        .toList()
      ..sort((first, second) => first.name.compareTo(second.name));

/// The methods a value of this class answers to.
///
/// `dispose` is the lifecycle the compiler already writes, and an operator
/// or a private member is not something TSX can call, so neither is offered.
List<MethodModel> _mapInstanceMethods(ClassElement classElement) {
  // Inherited methods are part of the surface: a `MaterialColor` answers to
  // everything a `Color` does, and a subtype that dropped them would stop
  // being usable where its supertype is.
  final owners = <InterfaceElement>[
    classElement,
    ...classElement.allSupertypes
        .map((supertype) => supertype.element)
        .where((element) => (element.name ?? 'Object') != 'Object'),
  ];
  final seen = <String>{};
  return owners
      .expand((owner) => owner.methods)
      .where(
        (method) =>
            !method.isStatic &&
            method.isPublic &&
            _callableName(method.name) &&
            method.name != 'dispose' &&
            // Diagnostics belong to the framework's own tooling, not to
            // an app: `debugFillProperties` guides nobody.
            !(method.name ?? '').startsWith('debug') &&
            !_objectMemberNames.contains(method.name) &&
            !method.metadata.hasVisibleForTesting &&
            !method.metadata.hasProtected &&
            // The nearest declaration wins, as Dart's own lookup does.
            seen.add(method.name ?? ''),
      )
      .map(
        (method) => MethodModel(
          name: method.name ?? '',
          doc: method.documentationComment ?? '',
          isStatic: false,
          returnType: encodeType(method.returnType),
          params: method.formalParameters
              .map((param) => _mapParam(classElement, param))
              .toList(),
        ),
      )
      .toList()
    ..sort((first, second) => first.name.compareTo(second.name));
}

/// Whether a name is one a TSX call can write: an operator is not.
bool _callableName(String? name) =>
    name != null && RegExp(r'^[a-zA-Z_$][a-zA-Z0-9_$]*$').hasMatch(name);

/// Static getters, which hand over a value without being asked anything.
List<FieldModel> _mapStaticGetters(ClassElement classElement) =>
    classElement.getters
        .where(
          (getter) =>
              getter.isStatic &&
              getter.isPublic &&
              (getter.name ?? '') != '' &&
              !_objectMemberNames.contains(getter.name) &&
              !getter.metadata.hasVisibleForTesting &&
              !getter.metadata.hasProtected &&
              // A `static const` is already a constant of this class.
              !getter.variable.isConst,
        )
        .map(
          (getter) => FieldModel(
            name: getter.name ?? '',
            doc: getter.documentationComment ?? '',
            type: encodeType(getter.returnType),
          ),
        )
        .toList()
      ..sort((first, second) => first.name.compareTo(second.name));

/// The members `ChangeNotifier` answers to, so an app never writes them.
///
/// A `RouterDelegate` is a `Listenable`, and `addListener` with
/// `removeListener` are abstract on it. Dart's own answer to that pair is to
/// mix in `ChangeNotifier`, which is exactly what Flutter's own delegates do
/// — so the pair is covered by the mixin rather than left to an app.
const _listenableMembers = {'addListener', 'removeListener'};

/// The mixin that answers `Listenable`, when this class needs one.
const _changeNotifier = 'ChangeNotifier';

/// Every class in the hierarchy, nearest first, `Object` excluded.
List<InterfaceElement> _hierarchy(ClassElement classElement) => [
  classElement,
  ...classElement.allSupertypes
      .map((supertype) => supertype.element)
      .where((element) => (element.name ?? 'Object') != 'Object'),
];

/// Whether a member of this name is answered somewhere in the hierarchy.
///
/// An abstract method on a base is not an app's to write when a subclass
/// already answers it: `RouterDelegate.popRoute` is abstract on nothing and
/// concrete here, and the nearest concrete declaration is what Dart uses.
bool _isAnswered(ClassElement classElement, String name) =>
    _hierarchy(classElement).any(
      (owner) =>
          owner.methods.any(
            (method) => method.name == name && !method.isAbstract,
          ) ||
          owner.getters.any(
            (getter) => getter.name == name && !getter.isAbstract,
          ),
    );

/// Whether the class is written by an app rather than built by it.
///
/// Only an abstract class is: a concrete one is constructed, and its
/// abstract-looking members are answered by itself.
bool _isImplementable(ClassElement classElement) => classElement.isAbstract;

/// The mixin this class needs to be written at all, if any.
String? _mapMixin(ClassElement classElement, Set<String> supertypes) {
  if (!_isImplementable(classElement) || !supertypes.contains('Listenable')) {
    return null;
  }
  final unanswered = _listenableMembers.where(
    (name) => !_isAnswered(classElement, name),
  );
  return unanswered.isEmpty ? null : _changeNotifier;
}

/// Whether this abstract member is one an app has to write.
bool _mustImplement(ClassElement classElement, String? name, String? mixin) =>
    name != null &&
    name.isNotEmpty &&
    !name.startsWith('_') &&
    _callableName(name) &&
    !_objectMemberNames.contains(name) &&
    !name.startsWith('debug') &&
    !(mixin == _changeNotifier && _listenableMembers.contains(name)) &&
    !_isAnswered(classElement, name);

/// The methods an app has to write to be this class.
///
/// A delegate is not built and not handed over: an app writes one, and what
/// it must write is the abstract surface — the class's own and everything it
/// inherits unanswered.
List<MethodModel> _mapAbstractMethods(
  ClassElement classElement,
  String? mixin,
) {
  if (!_isImplementable(classElement)) {
    return const [];
  }
  final seen = <String>{};
  return _hierarchy(classElement)
      .expand((owner) => owner.methods)
      .where(
        (method) =>
            !method.isStatic &&
            method.isAbstract &&
            !method.metadata.hasVisibleForTesting &&
            _mustImplement(classElement, method.name, mixin) &&
            seen.add(method.name ?? ''),
      )
      .map(
        (method) => MethodModel(
          name: method.name ?? '',
          doc: method.documentationComment ?? '',
          isStatic: false,
          returnType: encodeType(method.returnType),
          params: method.formalParameters
              .map((param) => _mapParam(classElement, param))
              .toList(),
        ),
      )
      .toList()
    ..sort((first, second) => first.name.compareTo(second.name));
}

/// The getters an app has to write to be this class: a header delegate's
/// `minExtent`, a table source's `rowCount`.
List<FieldModel> _mapAbstractGetters(ClassElement classElement, String? mixin) {
  if (!_isImplementable(classElement)) {
    return const [];
  }
  final seen = <String>{};
  return _hierarchy(classElement)
      .expand((owner) => owner.getters)
      .where(
        (getter) =>
            !getter.isStatic &&
            getter.isAbstract &&
            !getter.metadata.hasVisibleForTesting &&
            _mustImplement(classElement, getter.name, mixin) &&
            seen.add(getter.name ?? ''),
      )
      .map(
        (getter) => FieldModel(
          name: getter.name ?? '',
          doc: getter.documentationComment ?? '',
          type: encodeType(getter.returnType),
        ),
      )
      .toList()
    ..sort((first, second) => first.name.compareTo(second.name));
}

/// What a type parameter is bounded by, by name.
///
/// An unbounded parameter is bounded by `Object`, which is what Dart's own
/// `dynamic`-free answer to it is: anything non-null satisfies it.
String _boundName(TypeParameterElement parameter) {
  final bound = parameter.bound;
  if (bound == null) {
    return 'Object';
  }
  final encoded = encodeType(bound);
  return encoded is NamedTypeNode ? encoded.name : 'Object';
}

/// Whether the class, or anything it inherits from, offers `dispose()`.
bool _hasPublicDispose(ClassElement classElement) {
  final owners = [
    classElement,
    ...classElement.allSupertypes.map((supertype) => supertype.element),
  ];
  return owners.whereType<ClassElement>().any(
    (owner) => owner.methods.any(
      (method) => method.name == 'dispose' && method.isPublic,
    ),
  );
}

EnumEntity? mapEnum(EnumElement enumElement, String libraryLabel) {
  final name = enumElement.name ?? '';
  if (name.isEmpty || name.startsWith('_')) {
    return null;
  }

  final values = enumElement.constants
      .map(
        (constant) => EnumValueModel(
          name: constant.name ?? '',
          doc: constant.documentationComment ?? '',
        ),
      )
      .where((value) => value.name.isNotEmpty)
      .toList();

  return EnumEntity(
    name: name,
    library: libraryLabel,
    doc: enumElement.documentationComment ?? '',
    values: values,
  );
}

PluginClass mapPluginClass(ClassElement classElement, AssertInspector asserts) {
  final methods =
      classElement.methods
          .where((method) => method.isPublic && (method.name ?? '') != '')
          .map(
            (method) => MethodModel(
              name: method.name ?? '',
              doc: method.documentationComment ?? '',
              isStatic: method.isStatic,
              returnType: encodeType(method.returnType),
              params: method.formalParameters
                  .map((param) => _mapParam(classElement, param))
                  .toList(),
            ),
          )
          .toList()
        ..sort((first, second) => first.name.compareTo(second.name));

  return PluginClass(
    name: classElement.name ?? '',
    doc: classElement.documentationComment ?? '',
    supertypes: publicSupertypeNames(classElement),
    constructors: _mapConstructors(classElement, asserts),
    fields: _mapInstanceFields(classElement),
    methods: methods,
    constants: _mapConstants(classElement),
  );
}

// Object overrides carry no plugin data — a class redeclaring hashCode
// must not surface it as a readable property.
const _objectMemberNames = {'hashCode', 'runtimeType'};

List<FieldModel> _mapInstanceFields(ClassElement classElement) {
  // Inherited members are part of the class's usable surface: a consumer
  // reading `response.statusCode` cannot tell that BaseResponse declares it.
  final owners = <InterfaceElement>[
    classElement,
    ...classElement.allSupertypes
        .map((supertype) => supertype.element)
        .where((element) => (element.name ?? 'Object') != 'Object'),
  ];
  final fields = owners
      .expand((owner) => owner.getters)
      .where(
        (getter) =>
            getter.isPublic &&
            !getter.isStatic &&
            (getter.name ?? '').isNotEmpty &&
            !_objectMemberNames.contains(getter.name),
      )
      .map(
        (getter) => FieldModel(
          name: getter.name ?? '',
          doc:
              (getter.isOriginVariable
                  ? getter.variable.documentationComment
                  : getter.documentationComment) ??
              '',
          type: encodeType(getter.returnType),
        ),
      )
      .toList();

  final byName = <String, FieldModel>{};
  for (final field in fields) {
    // A subclass override wins: the first owner in the list is the class.
    byName.putIfAbsent(field.name, () => field);
  }
  final unique = byName.values.toList()
    ..sort((first, second) => first.name.compareTo(second.name));
  return unique;
}

FunctionModel mapTopLevelFunction(TopLevelFunctionElement element) =>
    FunctionModel(
      name: element.name ?? '',
      doc: element.documentationComment ?? '',
      returnType: encodeType(element.returnType),
      params: element.formalParameters
          .map((param) => _mapFunctionParam(param))
          .toList(),
    );

ParamModel _mapFunctionParam(FormalParameterElement param) => ParamModel(
  name: param.name ?? '',
  type: encodeType(param.type),
  display: param.type.getDisplayString(),
  isNamed: param.isNamed,
  isRequired: param.isRequired,
  defaultValue: param.defaultValueCode,
  doc: '',
  isDeprecated: param.metadata.hasDeprecated,
);

/// The constructors a caller can actually invoke.
///
/// An abstract class cannot be instantiated by its generative constructors,
/// but a factory one on it is a real way to make a value — `Client()` in
/// package:http is exactly that. Dropping every constructor of an abstract
/// class hid those classes from TSX entirely.
List<ConstructorModel> _mapConstructors(
  ClassElement classElement,
  AssertInspector asserts,
) {
  final constructors = classElement.constructors
      .where(
        (constructor) =>
            constructor.isPublic &&
            (!classElement.isAbstract || constructor.isFactory),
      )
      .map(
        (constructor) => ConstructorModel(
          name: _constructorName(constructor),
          doc: constructor.documentationComment ?? '',
          isConst: constructor.isConst,
          paramMemberAsserts: asserts.paramMemberAsserts(constructor),
          requiredOneOf: asserts.requiredOneOf(constructor),
          params: constructor.formalParameters
              .map((param) => _mapParam(classElement, param))
              .toList(),
        ),
      )
      .toList();

  constructors.sort((first, second) => first.name.compareTo(second.name));
  return constructors;
}

String _constructorName(ConstructorElement constructor) {
  final name = constructor.name ?? '';
  return name == 'new' ? '' : name;
}

ParamModel _mapParam(ClassElement classElement, FormalParameterElement param) {
  final paramName = param.name ?? '';
  return ParamModel(
    name: paramName,
    type: encodeType(param.type),
    display: param.type.getDisplayString(),
    isNamed: param.isNamed,
    isRequired: param.isRequired,
    defaultValue: param.defaultValueCode,
    doc: _backingFieldDoc(classElement, paramName),
    isDeprecated: param.metadata.hasDeprecated,
  );
}

String _backingFieldDoc(ClassElement classElement, String paramName) {
  final owners = [
    classElement,
    ...classElement.allSupertypes.map((supertype) => supertype.element),
  ];
  for (final owner in owners) {
    final doc = owner.getField(paramName)?.documentationComment;
    if (doc != null) {
      return doc;
    }
  }
  return '';
}

List<ConstantModel> _mapConstants(ClassElement classElement) {
  final constants = classElement.fields
      .where(
        (field) =>
            field.isStatic &&
            field.isConst &&
            field.isPublic &&
            (field.name ?? '').isNotEmpty,
      )
      .map(
        (field) => ConstantModel(
          name: field.name ?? '',
          type: encodeType(field.type),
          display: field.type.getDisplayString(),
          doc: field.documentationComment ?? '',
        ),
      )
      .toList();

  constants.sort((first, second) => first.name.compareTo(second.name));
  return constants;
}

/// The type arguments a class hands each of its supertypes.
///
/// `ShapeBorderClipper implements CustomClipper<Path>` is not the same as
/// implementing `CustomClipper<T>`: what it binds decides whether it can
/// stand in for a prop asking for one, which the compiler cannot know from
/// the name alone.
Map<String, List<TypeNode>> publicSupertypeBindings(
  InterfaceElement interfaceElement,
) {
  final bindings = <String, List<TypeNode>>{};
  for (final supertype in interfaceElement.allSupertypes) {
    final name = supertype.element.name ?? '';
    if (name.isEmpty ||
        name == 'Object' ||
        name.startsWith('_') ||
        supertype.typeArguments.isEmpty) {
      continue;
    }
    bindings[name] = supertype.typeArguments.map(encodeType).toList();
  }
  return bindings;
}

List<String> publicSupertypeNames(InterfaceElement interfaceElement) {
  return interfaceElement.allSupertypes
      .map((supertype) => supertype.element.name)
      .whereType<String>()
      .where((name) => name != 'Object' && !name.startsWith('_'))
      .toList();
}
