import type { ParamModel, TypeNode } from '../api/model';
import type { NamedSlot, WidgetSlots } from '../derive/slots';
import { EDGE_INSETS_TYPES, type ValueForms } from '../derive/value-forms';
import { jsxPropName } from '../generate/renames';

export interface SynthesisContext {
  enumValues: Record<string, string>;
  forms: ValueForms;
}

export interface SynthesizedExample {
  tsx: string;
  complete: boolean;
}

const INCOMPLETE_VALUE = '{…}';

const SCALAR_VALUES: Record<string, string> = {
  String: '"example"',
  int: '{8}',
  num: '{8}',
  double: '{1}',
  bool: '{true}',
};

const attrValue = (
  type: TypeNode,
  context: SynthesisContext,
): string | null => {
  switch (type.kind) {
    case 'nullable':
      return attrValue(type.inner, context);
    case 'scalar':
      return SCALAR_VALUES[type.name] ?? null;
    case 'enum': {
      const value = context.enumValues[type.name];
      return value === undefined ? null : `"${value}"`;
    }
    case 'named': {
      const [firstMember] =
        context.forms.constantMembers.get(type.name)?.keys() ?? [];
      if (firstMember !== undefined) {
        return `"${firstMember}"`;
      }
      if (EDGE_INSETS_TYPES.has(type.name)) {
        return '{8}';
      }
      return context.forms.constructibles.has(type.name) ? '{{}}' : null;
    }
    case 'function':
      return type.returnType.kind === 'void' ? '{() => {}}' : null;
    case 'list':
      return '{[]}';
    case 'map':
      return type.key.kind === 'scalar' && type.key.name !== 'bool'
        ? '{{}}'
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
): { param: ParamModel; value: string | null } | null => {
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

const slotValue = (slot: NamedSlot): string | null => {
  if (slot.mode === 'multi') {
    return '{[]}';
  }
  return slot.accepts === 'Widget' ? '{<Text>Content</Text>}' : null;
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

export const synthesizeTsx = (input: SynthesisInput): SynthesizedExample => {
  const { widgetName, params, slots, context } = input;
  const takenNames = new Set(params.map((candidate) => candidate.name));
  const attrs: string[] = [];
  const suppliedNames = new Set<string>();
  let complete = true;
  if (slots.children !== null) {
    suppliedNames.add(slots.children.param);
  }

  for (const candidate of params) {
    if (!candidate.required || candidate.name === slots.children?.param) {
      continue;
    }
    suppliedNames.add(candidate.name);

    const slot = slots.slots.find((entry) => entry.param === candidate.name);
    const value =
      slot !== undefined ? slotValue(slot) : attrValue(candidate.type, context);
    if (value === null) {
      complete = false;
    }
    attrs.push(
      `${jsxPropName(candidate.name, takenNames)}=${value ?? INCOMPLETE_VALUE}`,
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
    if (chosen.value === null) {
      complete = false;
    }
    const propName = jsxPropName(chosen.param.name, takenNames);
    attrs.push(`${propName}=${chosen.value ?? INCOMPLETE_VALUE}`);
  }

  const attrText = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  if (slots.children === null) {
    return { tsx: `<${widgetName}${attrText} />`, complete };
  }

  if (slots.children.kind === 'text') {
    return {
      tsx: `<${widgetName}${attrText}>${childrenBlock('text')}</${widgetName}>`,
      complete,
    };
  }
  return {
    tsx:
      `<${widgetName}${attrText}>\n` +
      `${childrenBlock(slots.children.kind)}\n` +
      `</${widgetName}>`,
    complete,
  };
};
