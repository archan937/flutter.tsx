import ts from 'typescript';

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
};

/** One exported declaration, as the file that ships it spells it. */
export interface DeclaredExport {
  name: string;
  /** A `const` (its resolved type) or a type alias / interface (its source). */
  kind: 'value' | 'type';
  signature: string;
  doc: string;
}

const isExported = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );

const docOf = (
  symbol: ts.Symbol | undefined,
  checker: ts.TypeChecker,
): string =>
  symbol === undefined
    ? ''
    : ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();

/** The declaration without its leading JSDoc, which is reported separately. */
const declarationText = (
  node: ts.TypeAliasDeclaration | ts.InterfaceDeclaration,
): string => {
  const keyword = ts.isTypeAliasDeclaration(node)
    ? 'export type'
    : 'export interface';
  const full = node.getText();
  const start = full.indexOf(keyword);
  return start === -1 ? full : full.slice(start);
};

/**
 * Reads what a source file exports, using the TypeScript checker rather than
 * a hand-kept list: what the reference documents is then the declaration the
 * IDE resolves, and the two cannot drift apart.
 */
export const extractDeclarations = (
  sourceFiles: string[],
): DeclaredExport[] => {
  const program = ts.createProgram(sourceFiles, COMPILER_OPTIONS);
  const checker = program.getTypeChecker();
  const declared: DeclaredExport[] = [];

  for (const path of sourceFiles) {
    const source = program.getSourceFile(path);
    if (source === undefined) {
      throw new Error(`declaration source ${path} could not be read.`);
    }

    for (const statement of source.statements) {
      if (!isExported(statement)) continue;

      if (
        ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement)
      ) {
        declared.push({
          name: statement.name.text,
          kind: 'type',
          signature: declarationText(statement),
          doc: docOf(checker.getSymbolAtLocation(statement.name), checker),
        });
        continue;
      }

      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        declared.push({
          name: declaration.name.text,
          kind: 'value',
          signature: checker.typeToString(
            checker.getTypeAtLocation(declaration.name),
            declaration,
            ts.TypeFormatFlags.NoTruncation,
          ),
          doc: docOf(checker.getSymbolAtLocation(declaration.name), checker),
        });
      }
    }
  }

  return declared;
};
