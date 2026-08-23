import type ts from 'typescript';

export interface TsxLocation {
  file: string;
  line: number;
  column: number;
}

export class TsxError extends Error {
  readonly code: string;
  readonly location: TsxLocation;

  constructor(code: string, message: string, location: TsxLocation) {
    super(
      `${code} ${location.file}:${location.line}:${location.column} — ${message}`,
    );
    this.name = 'TsxError';
    this.code = code;
    this.location = location;
  }
}

export const tsxErrorAt = (
  code: string,
  message: string,
  context: { sourceFile: ts.SourceFile; node: ts.Node },
): TsxError => {
  const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(
    context.node.getStart(context.sourceFile),
  );
  return new TsxError(code, message, {
    file: context.sourceFile.fileName,
    line: line + 1,
    column: character + 1,
  });
};
