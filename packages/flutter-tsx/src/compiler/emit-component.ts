import { printExpr } from './dart-print';
import type { IrComponent, IrValue, IrWidget } from './ir';
import { irWidgetToDart } from './ir-to-dart';
import type { CompileContext } from './lower';

const collectValue = (
  value: IrValue,
  context: CompileContext,
  names: Set<string>,
): void => {
  if (value.kind === 'widget') {
    collectWidget(value.widget, context, names);
    return;
  }
  if (value.kind === 'enumValue') {
    names.add(value.enumName);
    return;
  }
  if (value.kind === 'constantRef') {
    names.add(value.owner);
    return;
  }
  if (value.kind === 'construct') {
    names.add(value.className);
    for (const argument of value.args) {
      collectValue(argument.value, context, names);
    }
    return;
  }
  if (value.kind === 'widgetList') {
    for (const item of value.items) {
      collectValue(
        item.kind === 'if' ? item.child.value : item.value,
        context,
        names,
      );
    }
  }
};

const collectWidget = (
  widget: IrWidget,
  context: CompileContext,
  names: Set<string>,
): void => {
  names.add(widget.name);
  for (const argument of widget.args) {
    collectValue(argument.value, context, names);
  }
};

const importDirective = (library: string): string =>
  library === 'ui'
    ? "import 'dart:ui';"
    : `import 'package:flutter/${library}.dart';`;

// One barrel that covers every used name wins (material first, then
// cupertino); otherwise both contribute and any name neither re-exports pulls
// in its own defining library (e.g. services).
const importsFor = (names: Set<string>, context: CompileContext): string[] => {
  const barrelsOf = (name: string): string[] => context.exports.get(name) ?? [];
  const used = [...names];
  const covers = (barrel: string): boolean =>
    used.every((name) => barrelsOf(name).includes(barrel));

  const libraries = new Set<string>();
  if (used.length === 0 || covers('material')) {
    libraries.add('material');
  } else if (covers('cupertino')) {
    libraries.add('cupertino');
  } else {
    const covered = (name: string): boolean =>
      barrelsOf(name).some((barrel) => libraries.has(barrel));
    for (const primary of ['material', 'cupertino']) {
      if (
        used.some((name) => barrelsOf(name).includes(primary) && !covered(name))
      ) {
        libraries.add(primary);
      }
    }
    for (const name of used) {
      if (!covered(name)) {
        const barrels = barrelsOf(name);
        libraries.add(barrels[0] ?? context.libraries.get(name) ?? 'material');
      }
    }
  }

  return [...libraries]
    .map(importDirective)
    .sort((first, second) => first.localeCompare(second));
};

const RETURN_SITE = { indent: 4, used: 11, trailing: 1 };

const emitStatelessClass = (component: IrComponent): string => {
  const body = printExpr(
    irWidgetToDart(component.body, { privateMembers: false }),
    RETURN_SITE,
  );
  return `class ${component.name} extends StatelessWidget {
  const ${component.name}({super.key});

  @override
  Widget build(BuildContext context) {
    return ${body};
  }
}`;
};

export const emitDartFile = (
  components: IrComponent[],
  context: CompileContext,
): string => {
  const names = new Set<string>();
  for (const component of components) {
    collectWidget(component.body, context, names);
  }
  const classes = components.map(emitStatelessClass);
  const imports = importsFor(names, context);
  return `${imports.join('\n')}\n\n${classes.join('\n\n')}\n`;
};
