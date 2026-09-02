import type { IrComponent, IrValue, IrWidget } from './ir';
import type { CompileContext } from './lower';

/**
 * Every name a value mentions, so nothing it needs goes unimported.
 *
 * The switch is exhaustive on purpose: a value kind that walked no further
 * would silently drop the imports of everything inside it — a store-wrapped
 * tree hides its whole subtree behind one builder — and the Dart would name
 * classes it never imported. A new kind fails to typecheck here instead.
 */
/**
 * Whether a value kind can name a class this file has to import.
 *
 * The walk above handles every kind marked true. Listing all of them here is
 * what makes adding a kind a decision: a new one is a missing key, which does
 * not compile — the mistake that once let a value inside a builder, and later
 * one inside a method call, go uncollected.
 */
const NAMES_A_CLASS: Record<IrValue['kind'], boolean> = {
  widget: true,
  enumValue: true,
  constantRef: true,
  construct: true,
  widgetList: true,
  listValue: true,
  conditional: true,
  closureValue: true,
  builder: true,
  invoke: true,
  closure: false,
  string: false,
  number: false,
  boolean: false,
  interpolation: false,
  dartExpr: false,
  handlerRef: false,
  stateRef: false,
};

const collectValue = (
  value: IrValue,
  context: CompileContext,
  names: Set<string>,
): void => {
  // Text, numbers and references to this file's own members name no class,
  // and the table below says which kinds do — so the walk below only has to
  // handle those, and a kind nobody classified does not compile.
  if (!NAMES_A_CLASS[value.kind]) {
    return;
  }
  switch (value.kind) {
    case 'widget':
      collectWidget(value.widget, context, names);
      return;
    case 'enumValue':
      names.add(value.enumName);
      return;
    case 'constantRef':
      names.add(value.owner);
      return;
    case 'construct':
      names.add(value.className);
      for (const argument of value.args) {
        collectValue(argument.value, context, names);
      }
      return;
    case 'widgetList':
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
      return;
    case 'listValue':
      for (const item of value.items) {
        collectValue(item, context, names);
      }
      return;
    case 'conditional':
      collectValue(value.condition, context, names);
      collectValue(value.whenTrue, context, names);
      collectValue(value.whenFalse, context, names);
      return;
    case 'closureValue':
      collectValue(value.value, context, names);
      return;
    case 'builder':
      for (const guard of value.guards) {
        collectValue(guard.value, context, names);
      }
      collectValue(value.value, context, names);
      break;
    // The receiver is a member of this file; what it is called with may not
    // be — a Cupertino constant inside one needs Cupertino imported.
    case 'invoke':
      for (const argument of value.args) {
        collectValue(argument.value, context, names);
      }
      break;
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
  options: {
    /** Whether the file declares something that needs the Flutter barrel. */
    needsFlutter?: boolean;
    /**
     * Components the file names outside a widget tree — a route table points
     * at pages it never renders here, and each still needs its file imported.
     */
    alsoNamed?: readonly string[];
  } = {},
): string[] => {
  const { needsFlutter = true, alsoNamed = [] } = options;
  const names = new Set<string>(alsoNamed);
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
