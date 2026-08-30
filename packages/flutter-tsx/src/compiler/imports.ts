import type { IrComponent, IrValue, IrWidget } from './ir';
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
      if (item.kind === 'for') {
        collectValue(item.iterable, context, names);
      }
      collectValue(
        item.kind === 'value' ? item.value : item.child.value,
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

const importDirective = (library: string, hidden: string[] = []): string => {
  const uri = library === 'ui' ? 'dart:ui' : `package:flutter/${library}.dart`;
  // A component imported from a sibling file and a Flutter widget of the same
  // name would be an ambiguous import; the SDK's is the one to hide.
  const hide = hidden.length === 0 ? '' : ` hide ${hidden.join(', ')}`;
  return `import '${uri}'${hide};`;
};

// One barrel that covers every used name wins (material first, then
// cupertino); otherwise both contribute and any name neither re-exports pulls
// in its own defining library (e.g. services).
const importsFor = (
  names: Set<string>,
  context: CompileContext,
  options: { hidden?: string[]; needsFlutter: boolean },
): string[] => {
  const { hidden = [], needsFlutter } = options;
  const barrelsOf = (name: string): string[] => context.exports.get(name) ?? [];
  const used = [...names].filter((name) => !context.userWidgets.has(name));
  const covers = (barrel: string): boolean =>
    used.every((name) => barrelsOf(name).includes(barrel));

  const libraries = new Set<string>();
  if (used.length === 0) {
    // A file of plain helpers or models names nothing from Flutter, and an
    // import it does not use is an analyzer warning.
    if (!needsFlutter) {
      return [];
    }
    libraries.add('material');
  } else if (covers('material')) {
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
    .map((library) =>
      importDirective(
        library,
        hidden.filter((name) => barrelsOf(name).includes(library)),
      ),
    )
    .sort((first, second) => first.localeCompare(second));
};

export const importsForComponents = (
  components: IrComponent[],
  context: CompileContext,
  /** Whether the file declares something that needs the Flutter barrel. */
  needsFlutter = true,
): string[] => {
  const names = new Set<string>();
  for (const component of components) {
    collectWidget(component.body, context, names);
  }

  // Components declared in sibling files need their own file imported.
  const relative = [...names]
    .map((name) => context.componentImports.get(name))
    .filter((path): path is string => path !== undefined)
    .map((path) => `import '${path}';`);

  // Names an imported component shares with a Flutter widget must be hidden
  // from the SDK barrel, or Dart cannot tell the two apart.
  const shadowed = [...names]
    .filter(
      (name) => context.componentImports.has(name) && context.exports.has(name),
    )
    .sort();

  return [
    ...importsFor(names, context, { hidden: shadowed, needsFlutter }),
    ...relative,
  ];
};
