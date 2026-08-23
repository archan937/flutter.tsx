import type { ParamModel, TypeNode } from '@src/api/model';
import type { ChildrenSlot, WidgetSlots } from '@src/derive/slots';
import { tsTypeOf } from '@src/generate/ts-types';

export const CHILDREN_TS_TYPES: Record<ChildrenSlot['kind'], string> = {
  widgetList: 'FlutterChildren',
  widget: 'FlutterChild',
  text: 'TextChildren',
};

const stripOuterNullable = (node: TypeNode): TypeNode =>
  node.kind === 'nullable' ? node.inner : node;

export const propTsType = (
  param: ParamModel,
  widgetSlots: WidgetSlots,
): string => {
  const slot = widgetSlots.slots.find(
    (candidate) => candidate.param === param.name,
  );
  if (slot !== undefined) {
    return slot.mode === 'multi' ? 'FlutterChild[]' : 'FlutterChild';
  }
  return tsTypeOf(param.required ? param.type : stripOuterNullable(param.type));
};
