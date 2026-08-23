import type { ApiSnapshot, ParamModel, TypeNode } from '@src/api/model';

export interface ChildrenSlot {
  param: string;
  kind: 'widgetList' | 'widget' | 'text';
}

export interface NamedSlot {
  param: string;
  accepts: string;
  mode: 'single' | 'multi';
}

export interface WidgetSlots {
  children: ChildrenSlot | null;
  slots: NamedSlot[];
}

export type SlotMap = Record<string, WidgetSlots>;

interface Acceptance {
  accepts: string;
  mode: 'single' | 'multi';
}

const unwrapNullable = (type: TypeNode): TypeNode =>
  type.kind === 'nullable' ? type.inner : type;

const widgetTypeNames = (snapshot: ApiSnapshot): Set<string> => {
  const names = new Set(['Widget']);
  for (const [name, supertypes] of Object.entries(snapshot.hierarchy)) {
    if (supertypes.includes('Widget')) {
      names.add(name);
    }
  }
  return names;
};

const acceptanceOf = (
  type: TypeNode,
  widgetTypes: Set<string>,
): Acceptance | null => {
  const node = unwrapNullable(type);
  if (node.kind === 'widget') {
    return { accepts: 'Widget', mode: 'single' };
  }
  if (node.kind === 'named' && widgetTypes.has(node.name)) {
    return { accepts: node.name, mode: 'single' };
  }
  if (node.kind === 'list') {
    const item = unwrapNullable(node.item);
    if (item.kind === 'widget') {
      return { accepts: 'Widget', mode: 'multi' };
    }
    if (item.kind === 'named' && widgetTypes.has(item.name)) {
      return { accepts: item.name, mode: 'multi' };
    }
  }
  return null;
};

const childrenSlotOf = (
  params: ParamModel[],
  widgetTypes: Set<string>,
): ChildrenSlot | null => {
  const childrenParam = params.find(
    (candidate) =>
      candidate.name === 'children' &&
      acceptanceOf(candidate.type, widgetTypes)?.mode === 'multi',
  );
  if (childrenParam !== undefined) {
    return { param: childrenParam.name, kind: 'widgetList' };
  }

  const childParam = params.find(
    (candidate) =>
      candidate.name === 'child' &&
      acceptanceOf(candidate.type, widgetTypes)?.mode === 'single',
  );
  if (childParam !== undefined) {
    return { param: childParam.name, kind: 'widget' };
  }

  const textParam = params.find(
    (candidate) =>
      !candidate.named &&
      candidate.required &&
      candidate.type.kind === 'scalar' &&
      candidate.type.name === 'String',
  );
  if (textParam !== undefined) {
    return { param: textParam.name, kind: 'text' };
  }

  return null;
};

export const deriveSlots = (snapshot: ApiSnapshot): SlotMap => {
  const widgetTypes = widgetTypeNames(snapshot);
  const slotMap: SlotMap = {};

  for (const entity of snapshot.entities) {
    if (entity.kind !== 'widget') {
      continue;
    }
    const defaultConstructor = entity.constructors.find(
      (constructor) => constructor.name === '',
    );
    if (defaultConstructor === undefined) {
      slotMap[entity.name] = { children: null, slots: [] };
      continue;
    }

    const children = childrenSlotOf(defaultConstructor.params, widgetTypes);
    const slots = defaultConstructor.params
      .filter((candidate) => candidate.name !== children?.param)
      .flatMap((candidate) => {
        const acceptance = acceptanceOf(candidate.type, widgetTypes);
        return acceptance === null
          ? []
          : [{ param: candidate.name, ...acceptance }];
      })
      .sort((first, second) => first.param.localeCompare(second.param));

    slotMap[entity.name] = { children, slots };
  }

  return slotMap;
};
