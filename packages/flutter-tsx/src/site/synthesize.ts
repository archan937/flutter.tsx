import type { ParamModel, TypeNode } from '../api/model';
import { DATE_FORMS } from '../derive/date-forms';
import type { NamedSlot, WidgetSlots } from '../derive/slots';
import { EDGE_INSETS_TYPES, type ValueForms } from '../derive/value-forms';
import { jsxPropName } from '../generate/renames';
import { type UnwritableProp, unwritableReason } from './unwritable';

/** A class the SDK builds, and what its constructor asks for. */
export interface Constructible {
  name: string;
  params: readonly ParamModel[];
  /** The names it is generic over, in order, so arguments can be bound. */
  typeParams: readonly string[];
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
  construction: ReadonlyMap<string, Constructible>;
  /** Widgets asked for by name, and the tag that writes each one. */
  widgetExamples: ReadonlyMap<string, string>;
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

// `<Icon icon={Icons.add} />` — a namespaced value the example needs
// imported, and `new AssetImage(…)` is a class it names outright.
const NAMESPACE_REFERENCE = /\{([A-Z][A-Za-z0-9_]*)\./g;
const CONSTRUCTED_CLASS = /\bnew ([A-Z][A-Za-z0-9_]*)\(/g;

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
  const built = context.construction.get(type.name);
  // A type asked for with arguments is only satisfied by a class generic
  // over them: an `Animatable<Object>` is not a tween of one fixed type.
  const wantedArgs = (type.args ?? []).filter(
    (arg) => !(arg.kind === 'named' && arg.name === ANY_VALUE),
  );
  if (built === undefined || built.typeParams.length < wantedArgs.length) {
    return null;
  }
  // `ValueNotifier<int>` builds with an int: what the class is generic over
  // is bound to what the prop asked for.
  const bound = new Map(
    built.typeParams.map((name, index): [string, TypeNode] => [
      name,
      type.args?.[index] ?? { kind: 'unknown' },
    ]),
  );
  const substituted = (node: TypeNode): TypeNode =>
    node.kind === 'typeVar' ? (bound.get(node.name) ?? node) : node;
  const positional = built.params.filter(
    (param) => !param.named && param.required,
  );
  const named = built.params.filter((param) => param.named && param.required);
  const written = (param: ParamModel): string | null => {
    const value = attrValue(substituted(param.type), context);
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
  return { value: `{new ${built.name}(${args.join(', ')})}` };
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

// Dart's top type: a prop asking for one takes whatever it is given.
const ANY_VALUE = 'Object';

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
 * `color="red"`. Inside an expression, the value has to be the type itself,
 * so only the forms that are the type are written there.
 */
type ValuePosition = 'prop' | 'expression';

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
    case 'named': {
      if (KEY_TYPES.has(type.name) || type.name === ANY_VALUE) {
        return literal('"example"');
      }
      // A widget asked for by name is written as itself: `CupertinoTabBar`
      // is a tag, not a value to construct.
      const asWidget = context.widgetExamples.get(type.name);
      if (asWidget !== undefined) {
        return literal(`{${asWidget}}`);
      }
      if (ANIMATION_TYPES.has(type.name)) {
        return animationValue(type, context);
      }
      if (position === 'expression') {
        // A shorthand is a prop's own union; here the value has to be one a
        // component makes, or there is none to write.
        return ownedValue(type.name, context);
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
      // A value the component makes and keeps: the example is the component,
      // and the binding is the line that makes it.
      return ownedValue(type.name, context) ?? builtValue(type, context);
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
      // A typedef that takes named parameters is not satisfied by the
      // positional closure TSX writes, so it has no example yet.
      if (type.params.some((param) => param.named)) {
        return null;
      }
      if (answers.kind === 'widget') {
        return literal('{() => <Text>Content</Text>}');
      }
      // Any other callback answers with a value, and a value is exactly what
      // this function knows how to make: the callback is written around it.
      const awaited = answers.kind === 'future' ? answers.item : answers;
      // A Future that carries nothing is awaited for what it does, so the
      // callback that answers with one has nothing to write in its body.
      if (awaited.kind === 'void') {
        return literal('{async () => {}}');
      }
      const answer = attrValue(awaited, context, 'expression');
      if (answer === null) {
        return null;
      }
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
    // A Dart set is written as the collection it is, the same as a list.
    case 'list':
    case 'set':
      return literal('{[]}');
    case 'map':
      return type.key.kind === 'scalar' && type.key.name !== 'bool'
        ? literal('{{}}')
        : null;
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

const slotValue = (slot: NamedSlot): SynthesizedValue | null => {
  if (slot.mode === 'multi') {
    return literal('{[]}');
  }
  return slot.accepts === 'Widget' ? literal('{<Text>Content</Text>}') : null;
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
      slot !== undefined ? slotValue(slot) : attrValue(candidate.type, context);
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

/** Everything an example's source has to import from the package. */
export const exampleImports = (
  widgetName: string,
  example: SynthesizedExample,
): string[] =>
  [
    ...new Set([
      widgetName,
      'Text',
      ...example.bindings.flatMap((binding) => binding.imports),
      ...[...example.tsx.matchAll(NAMESPACE_REFERENCE)].map(
        (match) => match[1] ?? '',
      ),
      ...[...example.tsx.matchAll(CONSTRUCTED_CLASS)].map(
        (match) => match[1] ?? '',
      ),
    ]),
  ]
    .filter((name) => name !== '')
    .sort();
