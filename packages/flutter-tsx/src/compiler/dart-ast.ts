export type DartExpr =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'identifier'; name: string }
  | { kind: 'enumMember'; enumName: string; member: string }
  | { kind: 'call'; target: string; isConst: boolean; args: DartArgument[] }
  | { kind: 'closure'; params: string[]; body: ClosureBody }
  | {
      kind: 'conditional';
      condition: DartExpr;
      whenTrue: DartExpr;
      whenFalse: DartExpr;
    }
  | { kind: 'list'; isConst: boolean; items: DartListItem[] }
  | {
      kind: 'builder';
      params: string[];
      guards: BuilderGuard[];
      binds: BuilderBind[];
      value: DartExpr;
    };

/// `final <name> = <code>;` ahead of a return inside a builder block.
export interface BuilderBind {
  name: string;
  value: DartExpr;
}

export interface BuilderGuard {
  condition: string;
  bind: BuilderBind | null;
  value: DartExpr;
}

export type ClosureBody =
  | { kind: 'empty' }
  | { kind: 'expression'; code: string }
  // An expression body that must be printed column-aware, because the value
  // itself may wrap: `(context) => showDialog(\n  …,\n)`.
  | { kind: 'value'; value: DartExpr }
  | { kind: 'block'; lines: string[] };

export interface DartArgument {
  name: string | null;
  value: DartExpr;
}

export type DartListItem =
  | { kind: 'element'; value: DartExpr }
  | { kind: 'if'; condition: DartExpr; value: DartExpr }
  | { kind: 'for'; itemName: string; iterable: DartExpr; value: DartExpr };

export const stringLit = (value: string): DartExpr => ({
  kind: 'string',
  value,
});

export const numberLit = (value: string): DartExpr => ({
  kind: 'number',
  value,
});

export const boolLit = (value: boolean): DartExpr => ({
  kind: 'boolean',
  value,
});

export const identifier = (name: string): DartExpr => ({
  kind: 'identifier',
  name,
});

export const enumMember = (enumName: string, member: string): DartExpr => ({
  kind: 'enumMember',
  enumName,
  member,
});

export const call = (
  target: string,
  positional: DartExpr[],
  options: {
    named?: { name: string; value: DartExpr }[];
    isConst?: boolean;
  } = {},
): DartExpr => ({
  kind: 'call',
  target,
  isConst: options.isConst ?? false,
  args: [
    ...positional.map((value) => ({ name: null, value })),
    ...(options.named ?? []).map(({ name, value }) => ({ name, value })),
  ],
});

export const listLit = (
  items: DartListItem[],
  options: { isConst?: boolean } = {},
): DartExpr => ({
  kind: 'list',
  isConst: options.isConst ?? false,
  items,
});

export const closure = (
  params: string[],
  body: ClosureBody = { kind: 'empty' },
): DartExpr => ({
  kind: 'closure',
  params,
  body,
});

export const builderClosure = (builder: {
  params: string[];
  guards: BuilderGuard[];
  binds: BuilderBind[];
  value: DartExpr;
}): DartExpr => ({ kind: 'builder', ...builder });
