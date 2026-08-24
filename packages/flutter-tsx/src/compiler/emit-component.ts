import { printExpr } from './dart-print';
import type { IrComponent, IrValue, IrWidget } from './ir';
import { irWidgetToDart } from './ir-to-dart';
import type { CompileContext } from './lower';

const LIBRARY_IMPORTS = {
  cupertino: "import 'package:flutter/cupertino.dart';",
  material: "import 'package:flutter/material.dart';",
} as const;

const collectNamed = (
  name: string,
  context: CompileContext,
  libraries: Set<string>,
): void => {
  const library = context.libraries.get(name);
  if (library !== undefined) {
    libraries.add(library);
  }
};

const collectValue = (
  value: IrValue,
  context: CompileContext,
  libraries: Set<string>,
): void => {
  if (value.kind === 'widget') {
    collectWidget(value.widget, context, libraries);
    return;
  }
  if (value.kind === 'constantRef') {
    collectNamed(value.owner, context, libraries);
    return;
  }
  if (value.kind === 'construct') {
    collectNamed(value.className, context, libraries);
    for (const argument of value.args) {
      collectValue(argument.value, context, libraries);
    }
    return;
  }
  if (value.kind === 'widgetList') {
    for (const item of value.items) {
      collectValue(
        item.kind === 'if' ? item.child.value : item.value,
        context,
        libraries,
      );
    }
  }
};

const collectWidget = (
  widget: IrWidget,
  context: CompileContext,
  libraries: Set<string>,
): void => {
  collectNamed(widget.name, context, libraries);
  for (const argument of widget.args) {
    collectValue(argument.value, context, libraries);
  }
};

const importsFor = (libraries: Set<string>): string[] => {
  const imports: string[] = [];
  if (libraries.has('cupertino')) {
    imports.push(LIBRARY_IMPORTS.cupertino);
  }
  if (libraries.has('material') || imports.length === 0) {
    imports.push(LIBRARY_IMPORTS.material);
  }
  return imports;
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
  const libraries = new Set<string>();
  for (const component of components) {
    collectWidget(component.body, context, libraries);
  }
  const classes = components.map(emitStatelessClass);
  return `${importsFor(libraries).join('\n')}\n\n${classes.join('\n\n')}\n`;
};
