import type { DartExpr, DartListItem } from './dart-ast';
import type { IrArgument, IrChild, IrValue, IrWidget } from './ir';
import { closureBodyOf } from './statements';
import { interpolate } from './translate';

export interface DartNaming {
  privateMembers: boolean;
}

const memberName = (name: string, naming: DartNaming): string =>
  naming.privateMembers ? `_${name}` : name;

export const isConstable = (value: IrValue): boolean => {
  switch (value.kind) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'enumValue':
    case 'constantRef':
      return true;
    case 'construct':
      return (
        value.constConstructor !== false &&
        value.args.every((argument) => isConstable(argument.value))
      );
    case 'widget':
      return (
        value.widget.constConstructor &&
        value.widget.args.every((argument) => isConstable(argument.value))
      );
    case 'widgetList':
      return value.items.every(
        (item) => item.kind === 'value' && isConstable(item.value),
      );
    case 'listValue':
      return value.items.every(isConstable);
    case 'mapValue':
      return value.entries.every(
        (entry) => isConstable(entry.key) && isConstable(entry.value),
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
    case 'construct': {
      const generic =
        value.typeArguments === undefined || value.typeArguments.length === 0
          ? ''
          : `<${value.typeArguments.join(', ')}>`;
      return callToDart(
        {
          target:
            value.constructorName === ''
              ? `${value.className}${generic}`
              : `${value.className}${generic}.${value.constructorName}`,
          args: value.args,
          constable: isConstable(value),
        },
        naming,
        insideConst,
      );
    }
    case 'invoke':
      return callToDart(
        {
          target: `${value.receiver}.${value.method}`,
          args: value.args,
          // A method call is never const, whatever it is called with.
          constable: false,
        },
        naming,
        insideConst,
      );
    case 'closure':
      return {
        kind: 'closure',
        params: value.params,
        isAsync: value.isAsync,
        body: closureBodyOf(value.statements, naming),
      };
    case 'closureValue':
      return {
        kind: 'closure',
        params: value.params,
        ...(value.isAsync === true ? { isAsync: true } : {}),
        body: {
          kind: 'value',
          value: valueToDart(value.value, naming, insideConst),
        },
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
    case 'listValue': {
      const isConst = !insideConst && isConstable(value);
      return {
        kind: 'list',
        isConst,
        ...(value.set === undefined ? {} : { set: value.set }),
        items: value.items.map((item) => ({
          kind: 'element' as const,
          value: valueToDart(item, naming, insideConst || isConst),
        })),
      };
    }
    case 'mapValue': {
      const isConst = !insideConst && isConstable(value);
      const held =
        value.entries.length > 0 ||
        value.types.key === null ||
        value.types.value === null
          ? null
          : `${value.types.key}, ${value.types.value}`;
      return {
        kind: 'list',
        isConst,
        set: { itemType: held, braces: true },
        items: value.entries.map((entry) => ({
          kind: 'entry' as const,
          key: valueToDart(entry.key, naming, insideConst || isConst),
          value: valueToDart(entry.value, naming, insideConst || isConst),
        })),
      };
    }
    case 'builder':
      return {
        kind: 'builder',
        params: value.params,
        guards: value.guards.map((guard) => ({
          condition: guard.condition,
          bind:
            guard.bind === null
              ? null
              : {
                  name: guard.bind.name,
                  value: valueToDart(guard.bind.value, naming, insideConst),
                },
          value: valueToDart(guard.value, naming, insideConst),
        })),
        binds: value.binds.map((bind) => ({
          name: bind.name,
          value: valueToDart(bind.value, naming, insideConst),
        })),
        value: valueToDart(value.value, naming, insideConst),
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
  if (child.kind === 'for') {
    return {
      kind: 'for',
      itemName: child.itemName,
      iterable: valueToDart(child.iterable, naming, insideConst),
      value: valueToDart(child.child.value, naming, insideConst),
    };
  }
  return {
    kind: 'if',
    condition: valueToDart(child.condition, naming, insideConst),
    value: valueToDart(child.child.value, naming, insideConst),
  };
};

export const irValueToDart = (value: IrValue, naming: DartNaming): DartExpr =>
  valueToDart(value, naming, false);

export const irWidgetToDart = (
  widget: IrWidget,
  naming: DartNaming,
): DartExpr => valueToDart({ kind: 'widget', widget }, naming, false);
