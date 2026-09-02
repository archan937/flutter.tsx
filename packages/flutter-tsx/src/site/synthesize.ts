import type { ParamModel, TypeNode } from '../api/model';
import { DATE_FORMS } from '../derive/date-forms';
import type { NamedSlot, WidgetSlots } from '../derive/slots';
import { EDGE_INSETS_TYPES, type ValueForms } from '../derive/value-forms';
import { jsxPropName } from '../generate/renames';
import { type UnwritableProp, unwritableReason } from './unwritable';

/** A static that hands over a value nothing constructs. */
export interface Supplier {
  owner: string;
  method: string;
  params: readonly ParamModel[];
}

/** The context Flutter hands values over through, and its name in TSX. */
const BUILD_CONTEXT_TYPE = 'BuildContext';
const BUILD_CONTEXT_NAME = 'ctx';

/** A class the SDK builds, and what its constructor asks for. */
export interface Constructible {
  name: string;
  /** The constructor's own name, when the class builds only by name. */
  constructorName?: string;
  params: readonly ParamModel[];
  /** The names it is generic over, in order, so arguments can be bound. */
  typeParams: readonly string[];
  /**
   * What it hands the type it is standing in for, when that type is generic
   * and this class is not — `ShapeBorderClipper` is a `CustomClipper<Path>`,
   * so it satisfies a prop asking for one.
   */
  binds?: readonly TypeNode[];
}

export interface SynthesisContext {
  enumValues: Record<string, string>;
  forms: ValueForms;
  /** Types a component can make for itself, e.g. `new FocusNode()`. */
  ownedValues: ReadonlySet<string>;
  /**
   * How to make a value of a type: the class itself when it can be built,
   * or the concrete subclass that is the way to satisfy an abstract one —
   * an `ImageProvider` is written as an `AssetImage`.
   */
  construction: ReadonlyMap<string, readonly Constructible[]>;
  /** Widgets asked for by name, and the tag that writes each one. */
  widgetExamples: ReadonlyMap<string, string>;
  /**
   * Names the package exports only as a value — a class with static
   * constants — which therefore cannot be written as a type.
   */
  valueOnlyNames: ReadonlySet<string>;
  /** Types whose props accept a shorthand union, by name. */
  formNames: ReadonlySet<string>;
  /** Types the surface declares, and so can be written as a type. */
  declaredTypes: ReadonlySet<string>;
  /**
   * Types the framework hands over, and the statics that hand each one
   * over: a `FlutterView` by `View.of(context)`, an `AndroidViewController`
   * by `PlatformViewsService.initAndroidView(…)`.
   */
  suppliers: ReadonlyMap<string, readonly Supplier[]>;
}

/**
 * A line the example needs above its tag.
 *
 * Not every value is a literal: an animation is driven by the component that
 * holds it, a controller is owned by it. Those examples are components, and
 * the binding is the line a developer would really write.
 */
export interface ExampleBinding {
  line: string;
  imports: string[];
}

export interface SynthesizedExample {
  tsx: string;
  bindings: ExampleBinding[];
  complete: boolean;
  /** Every prop left unwritten, and why — never a placeholder alone. */
  unwritable: UnwritableProp[];
}

/** A synthesized value, with whatever has to be bound for it to exist. */
interface SynthesizedValue {
  value: string;
  binding?: ExampleBinding;
}

const INCOMPLETE_VALUE = '{…}';

// `<Icon icon={Icons.add} />` reads a value off a class, `Rect.fromLTRB(…)`
// calls a constructor on one, and `new AssetImage(…)` names one outright —
// each is a name the example has to import.
const NAMESPACE_REFERENCE = /\b([A-Z][A-Za-z0-9_]*)\./g;
// `new Map<ShortcutActivator, Intent>(…)` names the types it holds.
const CONSTRUCTED_CLASS = /\bnew ([A-Z][A-Za-z0-9_]*)\(/g;
// A Map is JavaScript's own; the package exports nothing by that name.
const BUILT_IN_CLASSES: ReadonlySet<string> = new Set(['Map']);

/** What a callback answers with, once a Future or a FutureOr is opened. */
const awaitedValue = (type: TypeNode): TypeNode => {
  if (type.kind === 'future') {
    return type.item;
  }
  return type.kind === 'named' && type.name === EITHER_TYPE
    ? (type.args?.[0] ?? { kind: 'unknown' })
    : type;
};

const literal = (value: string): SynthesizedValue => ({ value });

/**
 * An animation of the type the prop carries.
 *
 * A controller is an `Animation<double>` already; anything else runs between
 * two values of what it carries, which is what a tween is for.
 */
const animationValue = (
  type: TypeNode & { kind: 'named' },
  context: SynthesisContext,
): SynthesizedValue | null => {
  const [carried] = type.args ?? [];
  if (carried === undefined || carried.kind === 'scalar') {
    return { value: '{animation}', binding: ANIMATION_BINDING };
  }
  const from = attrValue(carried, context);
  const to = attrValue(carried, context);
  if (from === null || to === null || from.binding !== undefined) {
    return null;
  }
  return {
    value: `{tween(animation, { from: ${braced(from.value)}, to: ${braced(to.value)} })}`,
    binding: {
      line: ANIMATION_BINDING.line,
      imports: [...ANIMATION_BINDING.imports, 'tween'],
    },
  };
};

/**
 * `new AssetImage('images/logo.png')` — a value written where it is used.
 *
 * The class is the one the SDK offers for the type: `Image` asks for an
 * `ImageProvider`, and an `AssetImage` is one. Null when the arguments it
 * needs are not themselves expressible.
 */
const builtValue = (
  type: TypeNode & { kind: 'named' },
  context: SynthesisContext,
): SynthesizedValue | null => {
  // The simplest class that really satisfies the type: one that cannot carry
  // what the type asked for is not a way to write it at all — an
  // `Animatable<T>` is not a tween of one fixed type.
  const built = (context.construction.get(type.name) ?? []).find((candidate) =>
    satisfies(candidate, type),
  );
  if (built === undefined) {
    return null;
  }
  // `ValueNotifier<int>` builds with an int: what the class is generic over
  // is bound to what the prop asked for.
  // `ValueNotifier<int>` builds with an int. Where the type asked for the
  // widget's own parameter, the example picks a type and Dart infers the
  // widget's from it — which is how a Dart developer writes it too.
  const bound = new Map(
    built.typeParams.map((name, index): [string, TypeNode] => {
      const wanted = type.args?.[index];
      return [
        name,
        wanted === undefined || wanted.kind === 'typeVar'
          ? STAND_IN_TYPE
          : wanted,
      ];
    }),
  );
  const substituted = (node: TypeNode): TypeNode =>
    node.kind === 'typeVar' ? (bound.get(node.name) ?? node) : node;
  const positional = built.params.filter(
    (param) => !param.named && param.required,
  );
  const named = built.params.filter((param) => param.named && param.required);
  const written = (param: ParamModel): string | null => {
    // A generated constructor declares its arguments with the same unions a
    // prop has, so a shorthand is written here too.
    const value = attrValue(substituted(param.type), context, 'argument');
    return value === null || value.binding !== undefined
      ? null
      : braced(value.value);
  };
  const positionalText = positional.map(written);
  const namedText = named.map((param) => {
    const value = written(param);
    return value === null ? null : `${param.name}: ${value}`;
  });
  if ([...positionalText, ...namedText].some((value) => value === null)) {
    return null;
  }
  const args = [
    ...positionalText,
    ...(namedText.length === 0 ? [] : [`{ ${namedText.join(', ')} }`]),
  ];
  // `Rect.fromLTRB(…)` is a call, `new Rect(…)` a construction: whichever
  // the class really offers is what the example writes.
  const construction =
    built.constructorName === undefined
      ? `new ${built.name}`
      : `${built.name}.${built.constructorName}`;
  return { value: `{${construction}(${args.join(', ')})}` };
};

/** The Dart name of a type, as far as one shape can be compared to another. */
const shapeOf = (type: TypeNode): string =>
  type.kind === 'nullable'
    ? shapeOf(type.inner)
    : 'name' in type
      ? type.name
      : type.kind;

/**
 * Whether writing this class satisfies a prop asking for that type.
 *
 * A class generic over as much as the type asked for can be built for
 * whatever it asked for. One that is not generic can still stand in — if
 * what it hands the type is what was asked for, or if what was asked for is
 * `Object`, which anything is.
 */
const satisfies = (
  built: Constructible,
  type: TypeNode & { kind: 'named' },
): boolean => {
  const wanted = type.args ?? [];
  // A class generic over as much as the type asked for can be built for
  // whatever it asked for — including the widget's own type parameter, which
  // Dart infers from the value it is given.
  if (built.typeParams.length >= wanted.length) {
    return true;
  }
  return wanted.every((arg, index) => {
    // The widget's own type parameter is inferred from what it is given, so
    // a class carrying a concrete type satisfies it — but not a nullable
    // one: `Animatable<Color?>` cannot stand where a non-null T is wanted.
    if (arg.kind === 'typeVar') {
      const binding = built.binds?.[index];
      return (
        binding !== undefined &&
        binding.kind !== 'nullable' &&
        binding.kind !== 'typeVar'
      );
    }
    return (
      (arg.kind === 'named' && arg.name === ANY_VALUE) ||
      shapeOf(built.binds?.[index] ?? { kind: 'unknown' }) === shapeOf(arg)
    );
  });
};

/**
 * `MediaQuery.of(context)` — a value the framework hands over.
 *
 * Nothing constructs a `FlutterView`, an `AssetBundle` or an
 * `AndroidViewController`: Flutter makes them and hands them over through a
 * static, so calling that static is how an example writes one. The simplest
 * static whose arguments are themselves writable wins.
 */
const suppliedValue = (
  typeName: string,
  context: SynthesisContext,
): SynthesizedValue | null => {
  for (const supplier of context.suppliers.get(typeName) ?? []) {
    // Only what the static insists on: an optional argument left out is the
    // shortest true way to call it.
    const required = supplier.params.filter((param) => param.required);
    const written = required.map((param) =>
      param.type.kind === 'named' && param.type.name === BUILD_CONTEXT_TYPE
        ? { value: BUILD_CONTEXT_NAME }
        : attrValue(param.type, context, 'argument'),
    );
    if (written.some((value) => value === null)) {
      continue;
    }
    const positional = required
      .map((param, index) => ({ param, value: written[index] }))
      .filter((entry) => !entry.param.named);
    const named = required
      .map((param, index) => ({ param, value: written[index] }))
      .filter((entry) => entry.param.named);
    const args = [
      ...positional.map((entry) => braced(entry.value?.value ?? '')),
      ...(named.length === 0
        ? []
        : [
            `{ ${named
              .map(
                (entry) =>
                  `${entry.param.name}: ${braced(entry.value?.value ?? '')}`,
              )
              .join(', ')} }`,
          ]),
    ];
    const needsContext = written.some(
      (value) => value?.value === BUILD_CONTEXT_NAME,
    );
    return {
      value: `{${supplier.owner}.${supplier.method}(${args.join(', ')})}`,
      ...(needsContext
        ? {
            binding: {
              line: `const ${BUILD_CONTEXT_NAME} = useBuildContext();`,
              imports: ['useBuildContext', supplier.owner],
            },
          }
        : {}),
    };
  }
  return null;
};

/** `const focusNode = new FocusNode();` — a value the component makes. */
const ownedValue = (
  typeName: string,
  context: SynthesisContext,
): SynthesizedValue | null => {
  if (!context.ownedValues.has(typeName)) {
    return null;
  }
  const name = `${typeName[0]?.toLowerCase() ?? ''}${typeName.slice(1)}`;
  return {
    value: `{${name}}`,
    binding: {
      line: `const ${name} = new ${typeName}();`,
      imports: [typeName],
    },
  };
};

/**
 * A prop value written `{…}` as the expression inside it.
 *
 * An object stays wrapped: `() => {}` is an empty body where `() => ({})` is
 * the value the callback answers with.
 */
const braced = (value: string): string => {
  if (!value.startsWith('{')) {
    return value;
  }
  const inner = value.slice(1, -1);
  return inner.startsWith('{') ? `(${inner})` : inner;
};

// The Animation family: every one of these is what a controller hands over,
// and `useAnimation` is how a component gets one.
const ANIMATION_TYPES: ReadonlySet<string> = new Set([
  'Animation',
  'AnimationController',
  'Listenable',
  'ValueListenable',
]);

// `FutureOr<T>` is a T or a Future of one, so a T is always an answer.
const EITHER_TYPE = 'FutureOr';

// Dart's top type: a prop asking for one takes whatever it is given.
const ANY_VALUE = 'Object';
const DART_TYPE = 'Type';

/**
 * The type an example picks when the widget leaves it open.
 *
 * `UndoHistory<T>` takes a `ValueNotifier<T>`, and what T is comes from the
 * value: a text one makes it a `UndoHistory<String>`, which is what a Dart
 * developer would write.
 */
const STAND_IN_TYPE: TypeNode = { kind: 'scalar', name: 'String' };

// A key is written as the text or number that tells one item from another;
// the compiler makes the Key itself.
const KEY_TYPES: ReadonlySet<string> = new Set([
  'Key',
  'LocalKey',
  'ValueKey',
  'ObjectKey',
]);

const ANIMATION_BINDING: ExampleBinding = {
  line: 'const animation = useAnimation({ duration: 600 });',
  imports: ['useAnimation'],
};

const SCALAR_VALUES: Record<string, string> = {
  String: '"example"',
  int: '{8}',
  num: '{8}',
  double: '{1}',
  bool: '{true}',
};

/**
 * Where a value is being written.
 *
 * A prop accepts the shorthands its declared union offers — `padding={8}`,
 * `color="red"` — and so does an argument of a generated constructor, which
 * is declared with the same unions. A bare expression, like what a callback
 * answers with, is typed as the type itself, so only the forms that *are*
 * the type may be written there.
 */
type ValuePosition = 'prop' | 'argument' | 'expression';

const attrValue = (
  type: TypeNode,
  context: SynthesisContext,
  position: ValuePosition = 'prop',
): SynthesizedValue | null => {
  switch (type.kind) {
    case 'nullable':
      return attrValue(type.inner, context, position);
    case 'scalar': {
      const scalar = SCALAR_VALUES[type.name];
      return scalar === undefined ? null : literal(scalar);
    }
    case 'enum': {
      const value = context.enumValues[type.name];
      return value === undefined || position === 'expression'
        ? null
        : literal(`"${value}"`);
    }
    // A shorthand is available wherever the declaration carries the union.

    case 'named': {
      if (KEY_TYPES.has(type.name) || type.name === ANY_VALUE) {
        return literal('"example"');
      }
      // A `Type` value is a class; `Object` is one, and every SDK class is
      // one of those, so it is the example that is always true.
      if (type.name === DART_TYPE) {
        return literal(`"${ANY_VALUE}"`);
      }
      // A widget asked for by name is written as itself: `CupertinoTabBar`
      // is a tag, not a value to construct. Only a prop asks that way —
      // inside an expression a name like `Image` is as likely to be the
      // `dart:ui` class of that name, which is not a widget at all.
      const asWidget =
        position === 'prop' ? context.widgetExamples.get(type.name) : undefined;

      if (asWidget !== undefined) {
        return literal(`{${asWidget}}`);
      }
      if (ANIMATION_TYPES.has(type.name)) {
        return animationValue(type, context);
      }
      if (position === 'expression') {
        // A bare expression is typed as the type itself, so there is no
        // union to shorten — but a value the component makes, and one the
        // SDK builds, are the values themselves.
        return (
          ownedValue(type.name, context) ??
          builtValue(type, context) ??
          suppliedValue(type.name, context)
        );
      }
      const dateForm = DATE_FORMS.get(type.name);
      if (dateForm !== undefined) {
        return literal(`"${dateForm.example}"`);
      }
      const [firstMember] =
        context.forms.constantMembers.get(type.name)?.keys() ?? [];
      if (firstMember !== undefined) {
        return literal(`"${firstMember}"`);
      }
      if (EDGE_INSETS_TYPES.has(type.name)) {
        return literal('{8}');
      }
      if (context.forms.constructibles.has(type.name)) {
        return literal('{{}}');
      }
      // A value the component makes and keeps, one the SDK builds, or one
      // the framework hands over — in that order of directness.
      return (
        ownedValue(type.name, context) ??
        builtValue(type, context) ??
        suppliedValue(type.name, context)
      );
    }
    case 'function': {
      // What a callback answers with is the same whether or not it may be
      // null, and a Future is that value awaited.
      const answers =
        type.returnType.kind === 'nullable'
          ? type.returnType.inner
          : type.returnType;
      if (answers.kind === 'void') {
        return literal('{() => {}}');
      }
      if (answers.kind === 'widget') {
        return literal('{() => <Text>Content</Text>}');
      }
      // Any other callback answers with a value, and a value is exactly what
      // this function knows how to make: the callback is written around it.
      const awaited = awaitedValue(answers);
      // A Future that carries nothing is awaited for what it does, so the
      // callback that answers with one has nothing to write in its body.
      if (awaited.kind === 'void') {
        return literal('{async () => {}}');
      }
      const answer = attrValue(awaited, context, 'expression');
      if (answer === null) {
        return null;
      }
      // A FutureOr is satisfied by the value itself, so only a real Future
      // needs the callback to be async.
      const body = answers.kind === 'future' ? 'async () => ' : '() => ';
      return {
        value: `{${body}${braced(answer.value)}}`,
        ...(answer.binding === undefined ? {} : { binding: answer.binding }),
      };
    }
    // A generic value is whatever the example makes it: the widget's own
    // type parameter follows what it is given, and so does `Object`.
    case 'unknown':
    case 'typeVar':
      return literal('"example"');
    // A widget is written as a tag wherever a widget is asked for.
    case 'widget':
      return literal('{<Text>Content</Text>}');
    // A Dart set is written as the collection it is, the same as a list. An
    // empty one has to name what it holds, so one holding only a type
    // variable is not writable: there is no name to give.
    case 'list':
    case 'set': {
      if (type.item.kind !== 'typeVar') {
        return literal('{[]}');
      }
      // What the collection holds is the widget's own type parameter, and an
      // empty one would leave Dart nothing to infer it from — so the example
      // holds a value, which is what tells the widget what it is for.
      const item = attrValue(type.item, context, position);
      return item === null ? null : literal(`{[${braced(item.value)}]}`);
    }
    case 'map': {
      // A string-keyed map is an object; any other is written as the pairs
      // TypeScript writes a Map with, and both are real Dart maps.
      const key = attrValue(type.key, context, 'expression');
      const value = attrValue(type.value, context, 'expression');
      if (type.key.kind === 'scalar' && type.key.name !== 'bool') {
        return literal('{{}}');
      }
      if (key === null || value === null) {
        return null;
      }
      return {
        value: `{new Map([[${braced(key.value)}, ${braced(value.value)}]])}`,
        ...(value.binding === undefined ? {} : { binding: value.binding }),
      };
    }
    default:
      return null;
  }
};

// The first member with a canonical value wins; when none is expressible the
// first member is still emitted, as a visible placeholder on an example the
// caller is told is incomplete.
const pickOneOfMember = (
  group: string[],
  params: ParamModel[],
  context: SynthesisContext,
): { param: ParamModel; value: SynthesizedValue | null } | null => {
  const members = group.flatMap((name) => {
    const found = params.find((candidate) => candidate.name === name);
    return found === undefined ? [] : [found];
  });
  for (const member of members) {
    const value = attrValue(member.type, context);
    if (value !== null) {
      return { param: member, value };
    }
  }
  const [first] = members;
  return first === undefined ? null : { param: first, value: null };
};

const slotValue = (
  slot: NamedSlot,
  context: SynthesisContext,
): SynthesizedValue | null => {
  if (slot.mode === 'multi') {
    return literal('{[]}');
  }
  if (slot.accepts === 'Widget') {
    return literal('{<Text>Content</Text>}');
  }
  // A slot may ask for one particular widget — a `CupertinoTabScaffold`
  // wants a `CupertinoTabBar` — and that widget's own example is how one is
  // written.
  const tag = context.widgetExamples.get(slot.accepts);
  return tag === undefined ? null : literal(`{${tag}}`);
};

const childrenBlock = (kind: 'widgetList' | 'widget' | 'text'): string => {
  if (kind === 'text') {
    return 'Hello world';
  }
  if (kind === 'widget') {
    return '  <Text>Content</Text>';
  }
  return '  <Text>Item 1</Text>\n  <Text>Item 2</Text>';
};

export interface SynthesisInput {
  widgetName: string;
  params: ParamModel[];
  slots: WidgetSlots;
  context: SynthesisContext;
  // Groups a constructor assert demands a value from; every member is an
  // optional param, so the example must pick one or it throws at const-eval.
  requiredOneOf?: string[][];
}

/** The tag, given the attributes and what the widget takes as children. */
const tagText = (
  widgetName: string,
  attrs: string[],
  children: WidgetSlots['children'],
): string => {
  const attrText = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  if (children === null) {
    return `<${widgetName}${attrText} />`;
  }
  if (children.kind === 'text') {
    return `<${widgetName}${attrText}>${childrenBlock('text')}</${widgetName}>`;
  }
  return (
    `<${widgetName}${attrText}>\n` +
    `${childrenBlock(children.kind)}\n` +
    `</${widgetName}>`
  );
};

export const synthesizeTsx = (input: SynthesisInput): SynthesizedExample => {
  const { widgetName, params, slots, context } = input;
  const takenNames = new Set(params.map((candidate) => candidate.name));
  const attrs: string[] = [];
  const bindings = new Map<string, ExampleBinding>();
  const suppliedNames = new Set<string>();
  let complete = true;
  if (slots.children !== null) {
    suppliedNames.add(slots.children.param);
  }

  const unwritable: UnwritableProp[] = [];

  // One binding per line written, however many props ask for it: two
  // transitions driven by one animation is what a developer would write.
  const record = (
    value: SynthesizedValue | null,
    param: ParamModel,
  ): string => {
    if (value === null) {
      complete = false;
      unwritable.push({
        prop: param.name,
        type: param.display,
        reason: unwritableReason(param.type, context.construction),
      });
      return INCOMPLETE_VALUE;
    }
    if (value.binding !== undefined) {
      bindings.set(value.binding.line, value.binding);
    }
    return value.value;
  };

  for (const candidate of params) {
    if (!candidate.required || candidate.name === slots.children?.param) {
      continue;
    }
    suppliedNames.add(candidate.name);

    const slot = slots.slots.find((entry) => entry.param === candidate.name);
    const value =
      slot !== undefined
        ? slotValue(slot, context)
        : attrValue(candidate.type, context);
    attrs.push(
      `${jsxPropName(candidate.name, takenNames)}=${record(value, candidate)}`,
    );
  }

  for (const group of input.requiredOneOf ?? []) {
    if (group.some((name) => suppliedNames.has(name))) {
      continue;
    }
    const chosen = pickOneOfMember(group, params, context);
    if (chosen === null) {
      continue;
    }
    const propName = jsxPropName(chosen.param.name, takenNames);
    attrs.push(`${propName}=${record(chosen.value, chosen.param)}`);
  }

  return {
    tsx: tagText(widgetName, attrs, slots.children),
    bindings: [...bindings.values()],
    complete,
    unwritable,
  };
};

/**
 * The example as source a developer could paste.
 *
 * A tag whose values are all literals stands on its own. One with bindings is
 * a component, because that is where a value the component holds can live —
 * and every reader of an example (the docs, the typecheck probe, the analyze
 * sweep) renders it from here, so they can never disagree.
 */
export const exampleSource = (
  widgetName: string,
  example: SynthesizedExample,
  options: { component: boolean },
): string => {
  if (!options.component && example.bindings.length === 0) {
    return example.tsx;
  }
  const indented = (spaces: number): string =>
    example.tsx.replaceAll('\n', `\n${' '.repeat(spaces)}`);
  if (example.bindings.length === 0) {
    return `export const ${widgetName}Example = () => (\n  ${indented(2)}\n);`;
  }
  const lines = example.bindings.map((binding) => `  ${binding.line}`);
  return (
    `export const ${widgetName}Example = () => {\n` +
    `${lines.join('\n')}\n\n` +
    `  return (\n    ${indented(4)}\n  );\n` +
    '};'
  );
};

/**
 * Everything an example's source has to import from the package.
 *
 * A name written as a type — the key of a `Map<ShortcutActivator, …>` — is
 * imported as one, which is what `verbatimModuleSyntax` asks for.
 */
export const exampleImports = (
  widgetName: string,
  example: SynthesizedExample,
): string[] => {
  const named = (pattern: RegExp): string[] =>
    [...example.tsx.matchAll(pattern)].map((match) => match[1] ?? '');
  const values = new Set([
    widgetName,
    'Text',
    ...example.bindings.flatMap((binding) => binding.imports),
    ...named(NAMESPACE_REFERENCE),
    ...named(CONSTRUCTED_CLASS).filter((name) => !BUILT_IN_CLASSES.has(name)),
  ]);
  return [...values].filter((name) => name !== '').sort();
};
