import 'package:analyzer/dart/element/element.dart';

import 'api_model.dart';
import 'assert_inspector.dart';
import 'type_encoder.dart';

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
  if (classElement.isAbstract && constants.isEmpty) {
    return null;
  }

  final constructors = _mapConstructors(classElement, asserts);
  final supertypes = publicSupertypeNames(classElement);
  final doc = classElement.documentationComment ?? '';

  // What a value of this type can be read for — `constraints.maxWidth` is
  // only compilable because the field is known here.
  final fields = _mapInstanceFields(classElement);

  if (supertypes.contains('Widget')) {
    return WidgetEntity(
      name: name,
      library: libraryLabel,
      doc: doc,
      supertypes: supertypes,
      constructors: constructors,
      constants: constants,
      fields: fields,
    );
  }
  return ClassEntity(
    name: name,
    library: libraryLabel,
    doc: doc,
    supertypes: supertypes,
    constructors: constructors,
    constants: constants,
    fields: fields,
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

List<String> publicSupertypeNames(InterfaceElement interfaceElement) {
  return interfaceElement.allSupertypes
      .map((supertype) => supertype.element.name)
      .whereType<String>()
      .where((name) => name != 'Object' && !name.startsWith('_'))
      .toList();
}
