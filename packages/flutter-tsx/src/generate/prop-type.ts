import type { ParamModel, TypeNode } from '../api/model';
import type { ChildrenSlot, WidgetSlots } from '../derive/slots';
import { tsTypeOf } from './ts-types';

export const CHILDREN_TS_TYPES: Record<ChildrenSlot['kind'], string> = {
  widgetList: 'FlutterChildren',
  widget: 'FlutterChild',
  text: 'TextChildren',
};

const stripOuterNullable = (node: TypeNode): TypeNode =>
  node.kind === 'nullable' ? node.inner : node;

export const valueFormTsType = (
  node: TypeNode,
  formNames: ReadonlySet<string>,
): string => {
  const unwrapped = stripOuterNullable(node);
  if (unwrapped.kind === 'named' && formNames.has(unwrapped.name)) {
    const value = `${unwrapped.name}Value`;
    return node.kind === 'nullable' ? `${value} | null` : value;
  }
  // What a collection holds is written the same way a prop is: a map of
  // shortcut activators to intents accepts the same shorthands.
  if (unwrapped.kind === 'map') {
    const key = valueFormTsType(unwrapped.key, formNames);
    const held = valueFormTsType(unwrapped.value, formNames);
    const map =
      unwrapped.key.kind === 'scalar' && unwrapped.key.name === 'String'
        ? `Record<string, ${held}>`
        : unwrapped.key.kind === 'scalar' && unwrapped.key.name !== 'bool'
          ? `Record<number, ${held}>`
          : `Map<${key}, ${held}>`;
    return node.kind === 'nullable' ? `${map} | null` : map;
  }
  if (unwrapped.kind === 'list' || unwrapped.kind === 'set') {
    const item = valueFormTsType(unwrapped.item, formNames);
    const list = item.includes('|') ? `(${item})[]` : `${item}[]`;
    return node.kind === 'nullable' ? `${list} | null` : list;
  }
  return tsTypeOf(node);
};

export const propTsType = (
  param: ParamModel,
  widgetSlots: WidgetSlots,
  formNames: ReadonlySet<string>,
): string => {
  const slot = widgetSlots.slots.find(
    (candidate) => candidate.param === param.name,
  );
  if (slot !== undefined) {
    return slot.mode === 'multi' ? 'FlutterChild[]' : 'FlutterChild';
  }
  return valueFormTsType(
    param.required ? param.type : stripOuterNullable(param.type),
    formNames,
  );
};
