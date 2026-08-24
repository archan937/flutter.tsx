import type { DartExpr, DartListItem } from './dart-ast';
import type { IrChild, IrValue, IrWidget } from './ir';

export interface DartNaming {
  privateMembers: boolean;
}

const memberName = (name: string, naming: DartNaming): string =>
  naming.privateMembers ? `_${name}` : name;

const isConstable = (value: IrValue): boolean => {
  switch (value.kind) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'enumValue':
      return true;
    case 'widget':
      return value.widget.args.every((argument) => isConstable(argument.value));
    case 'widgetList':
      return value.items.every(
        (item) => item.kind === 'value' && isConstable(item.value),
      );
    default:
      return false;
  }
};

const valueToDart = (
  value: IrValue,
  naming: DartNaming,
  insideConst: boolean,
): DartExpr => {
  switch (value.kind) {
    case 'string':
      return { kind: 'string', value: value.value };
    case 'number':
      return { kind: 'number', value: value.value };
    case 'boolean':
      return { kind: 'boolean', value: value.value };
    case 'enumValue':
      return {
        kind: 'enumMember',
        enumName: value.enumName,
        member: value.member,
      };
    case 'handlerRef':
    case 'stateRef':
      return { kind: 'identifier', name: memberName(value.name, naming) };
    case 'raw':
      return { kind: 'identifier', name: value.node.getText() };
    case 'widget':
      return widgetToDart(value.widget, naming, insideConst);
    case 'widgetList':
      return {
        kind: 'list',
        items: value.items.map((item) =>
          childToDart(item, naming, insideConst),
        ),
      };
  }
};

const childToDart = (
  child: IrChild,
  naming: DartNaming,
  insideConst: boolean,
): DartListItem => {
  if (child.kind === 'value') {
    return {
      kind: 'element',
      value: valueToDart(child.value, naming, insideConst),
    };
  }
  return {
    kind: 'if',
    condition: valueToDart(child.condition, naming, insideConst),
    value: valueToDart(child.child.value, naming, insideConst),
  };
};

const widgetToDart = (
  widget: IrWidget,
  naming: DartNaming,
  insideConst: boolean,
): DartExpr => {
  const constable = !insideConst && isConstable({ kind: 'widget', widget });
  const childConst = insideConst || constable;
  return {
    kind: 'call',
    target: widget.name,
    isConst: constable,
    args: widget.args.map((argument) => ({
      name: argument.positional ? null : argument.param,
      value: valueToDart(argument.value, naming, childConst),
    })),
  };
};

export const irWidgetToDart = (
  widget: IrWidget,
  naming: DartNaming,
): DartExpr => widgetToDart(widget, naming, false);
