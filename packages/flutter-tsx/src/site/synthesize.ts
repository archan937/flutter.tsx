import type { ParamModel, TypeNode } from '@src/api/model';
import type { WidgetSlots } from '@src/derive/slots';
import { jsxPropName } from '@src/generate/renames';

export interface SynthesisContext {
  enumValues: Record<string, string>;
  constantsByType: Record<string, string>;
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
  double: '{16}',
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
      const constant = context.constantsByType[type.name];
      return constant === undefined ? null : `{${constant}}`;
    }
    case 'function':
      return type.returnType.kind === 'void' ? '{() => {}}' : null;
    case 'list':
    case 'set':
      return '{[]}';
    case 'map':
      return '{{}}';
    default:
      return null;
  }
};

const slotValue = (mode: 'single' | 'multi'): string =>
  mode === 'single' ? '{<Text>Content</Text>}' : '{[]}';

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
}

export const synthesizeTsx = (input: SynthesisInput): SynthesizedExample => {
  const { widgetName, params, slots, context } = input;
  const takenNames = new Set(params.map((candidate) => candidate.name));
  const attrs: string[] = [];
  let complete = true;

  for (const candidate of params) {
    if (
      !candidate.required ||
      candidate.name === 'key' ||
      candidate.name === slots.children?.param
    ) {
      continue;
    }

    const slot = slots.slots.find((entry) => entry.param === candidate.name);
    const value =
      slot !== undefined
        ? slotValue(slot.mode)
        : attrValue(candidate.type, context);
    if (value === null) {
      complete = false;
    }
    attrs.push(
      `${jsxPropName(candidate.name, takenNames)}=${value ?? INCOMPLETE_VALUE}`,
    );
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
