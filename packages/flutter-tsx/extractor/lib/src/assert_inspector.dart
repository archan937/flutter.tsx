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

  /// Parameter groups an assert demands at least one value from. Two shapes
  /// appear in the SDK: a disjunction of null checks
  /// (`a != null || b != null`) and an exclusive-or of null checks
  /// (`(a == null) != (b == null)`). A conjunction like
  /// `a == null || b == null` is mutual exclusion, not a requirement, and is
  /// deliberately not a group.
  List<List<String>> requiredOneOf(ConstructorElement constructor) {
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
      return const [];
    }

    final groups = <List<String>>[];
    for (final initializer
        in declaration.initializers.whereType<AssertInitializer>()) {
      final group = _oneOfGroup(initializer.condition, paramNames);
      if (group != null && group.length > 1) {
        groups.add(group);
      }
    }
    return groups;
  }

  /// `a != null || b != null || …` — every operand must be a non-null check
  /// on a parameter, or the whole assert says something else.
  List<String>? _disjunctionGroup(
    Expression expression,
    Set<String> paramNames,
  ) {
    if (expression is ParenthesizedExpression) {
      return _disjunctionGroup(expression.expression, paramNames);
    }
    if (expression is! BinaryExpression) {
      return null;
    }
    if (expression.operator.lexeme == '||') {
      final left = _disjunctionGroup(expression.leftOperand, paramNames);
      final right = _disjunctionGroup(expression.rightOperand, paramNames);
      return left == null || right == null ? null : [...left, ...right];
    }
    final name = _nullComparison(expression, '!=', paramNames);
    return name == null ? null : [name];
  }

  /// `(a == null) != (b == null)` — exactly one of the two, so supplying
  /// either satisfies the requirement.
  List<String>? _exclusiveGroup(
    BinaryExpression expression,
    Set<String> paramNames,
  ) {
    final left = _nullCheckOperand(expression.leftOperand, paramNames);
    final right = _nullCheckOperand(expression.rightOperand, paramNames);
    return left == null || right == null ? null : [left, right];
  }

  /// Parens inside a disjunction are handled by [_disjunctionGroup]; the
  /// exclusive form is only recognised as the whole condition, which is the
  /// only shape the SDK uses. A shape this misses cannot pass silently — the
  /// analyze sweep turns red on the const-eval it produces.
  List<String>? _oneOfGroup(Expression condition, Set<String> paramNames) {
    if (condition is BinaryExpression && condition.operator.lexeme == '!=') {
      final exclusive = _exclusiveGroup(condition, paramNames);
      if (exclusive != null) {
        return exclusive;
      }
    }
    return _disjunctionGroup(condition, paramNames);
  }

  /// The parameter name in `<param> == null`, when that is the whole operand.
  String? _nullCheckOperand(Expression operand, Set<String> paramNames) {
    final inner = operand is ParenthesizedExpression
        ? operand.expression
        : operand;
    return inner is BinaryExpression
        ? _nullComparison(inner, '==', paramNames)
        : null;
  }

  String? _nullComparison(
    BinaryExpression expression,
    String operator,
    Set<String> paramNames,
  ) {
    if (expression.operator.lexeme != operator) {
      return null;
    }
    final left = expression.leftOperand;
    final right = expression.rightOperand;
    if (right is! NullLiteral || left is! SimpleIdentifier) {
      return null;
    }
    return paramNames.contains(left.name) ? left.name : null;
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
