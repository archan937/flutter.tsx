import type { DartExpr, DartListItem } from './dart-ast';
import type { IrArgument, IrChild, IrValue, IrWidget } from './ir';
import { closureBodyOf } from './statements';
import { interpolate } from './translate';

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
    case 'constantRef':
      return true;
    case 'construct':
      return value.args.every((argument) => isConstable(argument.value));
    case 'widget':
      return (
        value.widget.constConstructor &&
        value.widget.args.every((argument) => isConstable(argument.value))
      );
    case 'widgetList':
      return value.items.every(
        (item) => item.kind === 'value' && isConstable(item.value),
      );
    default:
      return false;
  }
};

interface CallShape {
  target: string;
  args: IrArgument[];
  constable: boolean;
}

const callToDart = (
  call: CallShape,
  naming: DartNaming,
  insideConst: boolean,
): DartExpr => {
  const isConst = !insideConst && call.constable;
  const childConst = insideConst || isConst;
  return {
    kind: 'call',
    target: call.target,
    isConst,
    args: call.args.map((argument) => ({
      name: argument.positional ? null : argument.param,
      value: valueToDart(argument.value, naming, childConst),
    })),
  };
};

// A fully-literal list inside a non-const call takes one `const` on the list
// itself (prefer_const_literals_to_create_immutables), not per element.
const listToDart = (
  value: Extract<IrValue, { kind: 'widgetList' }>,
  naming: DartNaming,
  insideConst: boolean,
): DartExpr => {
  const isConst = !insideConst && isConstable(value);
  const childConst = insideConst || isConst;
  return {
    kind: 'list',
    isConst,
    items: value.items.map((item) => childToDart(item, naming, childConst)),
  };
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
    case 'constantRef':
      return {
        kind: 'enumMember',
        enumName: value.owner,
        member: value.member,
      };
    case 'construct':
      return callToDart(
        {
          target:
            value.constructorName === ''
              ? value.className
              : `${value.className}.${value.constructorName}`,
          args: value.args,
          constable: isConstable(value),
        },
        naming,
        insideConst,
      );
    case 'closure':
      return {
        kind: 'closure',
        params: value.params,
        body: closureBodyOf(value.statements),
      };
    case 'conditional':
      return {
        kind: 'conditional',
        condition: valueToDart(value.condition, naming, insideConst),
        whenTrue: valueToDart(value.whenTrue, naming, insideConst),
        whenFalse: valueToDart(value.whenFalse, naming, insideConst),
      };
    case 'interpolation':
      return { kind: 'identifier', name: interpolate(value.parts) };
    case 'dartExpr':
      return { kind: 'identifier', name: value.dart };
    case 'handlerRef':
    case 'stateRef':
      return { kind: 'identifier', name: memberName(value.name, naming) };
    case 'raw':
      return { kind: 'identifier', name: value.node.getText() };
    case 'widget':
      return callToDart(
        {
          target: value.widget.name,
          args: value.widget.args,
          constable: isConstable(value),
        },
        naming,
        insideConst,
      );
    case 'widgetList':
      return listToDart(value, naming, insideConst);
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

export const irWidgetToDart = (
  widget: IrWidget,
  naming: DartNaming,
): DartExpr => valueToDart({ kind: 'widget', widget }, naming, false);
