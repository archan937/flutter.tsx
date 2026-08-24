import 'package:analyzer/dart/analysis/features.dart';
import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/dart/element/element.dart';

/// Detects constructor asserts that access members of their parameters
/// (`assert(children.length > 0)`): such a constructor can never be invoked
/// `const` with arbitrary values, so const inference must skip it.
class AssertInspector {
  final _units = <String, CompilationUnit>{};

  bool paramMemberAsserts(ConstructorElement constructor) {
    final className = constructor.enclosingElement.name ?? '';
    final constructorName = constructor.name ?? '';
    final normalizedName = constructorName == 'new' ? '' : constructorName;
    final paramNames = constructor.formalParameters
        .map((param) => param.name ?? '')
        .toSet();

    final declaration = _constructorDeclaration(
      constructor,
      className,
      normalizedName,
    );
    if (declaration == null) {
      return false;
    }

    final visitor = _ParamMemberVisitor(paramNames);
    for (final initializer
        in declaration.initializers.whereType<AssertInitializer>()) {
      initializer.condition.accept(visitor);
    }
    return visitor.found;
  }

  ConstructorDeclaration? _constructorDeclaration(
    ConstructorElement constructor,
    String className,
    String constructorName,
  ) {
    final source = constructor.firstFragment.libraryFragment.source.fullName;
    final unit = _units.putIfAbsent(
      source,
      () => parseFile(
        path: source,
        featureSet: FeatureSet.latestLanguageVersion(),
      ).unit,
    );
    final classDeclaration = unit.declarations
        .whereType<ClassDeclaration>()
        .where(
          (declaration) => declaration.namePart.typeName.lexeme == className,
        )
        .firstOrNull;
    return classDeclaration?.body.members
        .whereType<ConstructorDeclaration>()
        .where(
          (ConstructorDeclaration declaration) =>
              (declaration.name?.lexeme ?? '') == constructorName,
        )
        .firstOrNull;
  }
}

class _ParamMemberVisitor extends RecursiveAstVisitor<void> {
  _ParamMemberVisitor(this.paramNames);

  final Set<String> paramNames;
  bool found = false;

  @override
  void visitPrefixedIdentifier(PrefixedIdentifier node) {
    if (paramNames.contains(node.prefix.name)) {
      found = true;
    }
    super.visitPrefixedIdentifier(node);
  }

  @override
  void visitPropertyAccess(PropertyAccess node) {
    final target = node.target;
    if (target is SimpleIdentifier && paramNames.contains(target.name)) {
      found = true;
    }
    super.visitPropertyAccess(node);
  }

  @override
  void visitMethodInvocation(MethodInvocation node) {
    final target = node.target;
    if (target is SimpleIdentifier && paramNames.contains(target.name)) {
      found = true;
    }
    super.visitMethodInvocation(node);
  }
}
