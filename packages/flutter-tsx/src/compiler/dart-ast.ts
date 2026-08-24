export type DartExpr =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'identifier'; name: string }
  | { kind: 'enumMember'; enumName: string; member: string }
  | { kind: 'call'; target: string; isConst: boolean; args: DartArgument[] }
  | { kind: 'closure'; params: string[] }
  | { kind: 'list'; isConst: boolean; items: DartListItem[] };

export interface DartArgument {
  name: string | null;
  value: DartExpr;
}

export type DartListItem =
  | { kind: 'element'; value: DartExpr }
  | { kind: 'if'; condition: DartExpr; value: DartExpr };

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

export const closure = (params: string[]): DartExpr => ({
  kind: 'closure',
  params,
});
