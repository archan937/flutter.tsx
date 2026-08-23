import ts from 'typescript';

import { TsxError, tsxErrorAt } from './diagnostics';

export interface StateBinding {
  name: string;
  setterName: string;
  initialText: string;
  dartType: string;
  initializer: ts.Expression;
}

export interface PluginBinding {
  binding: string;
  hook: string;
  call: ts.CallExpression;
}

export interface HandlerBinding {
  name: string;
  isAsync: boolean;
  body: ts.ArrowFunction;
}

export interface ComponentAnalysis {
  name: string;
  states: StateBinding[];
  plugins: PluginBinding[];
  handlers: HandlerBinding[];
  effects: ts.CallExpression[];
  returnJsx: ts.Expression;
  sourceFile: ts.SourceFile;
}

export interface ComponentSummary {
  name: string;
  states: {
    name: string;
    setterName: string;
    initialText: string;
    dartType: string;
  }[];
  plugins: { binding: string; hook: string }[];
  handlers: { name: string; isAsync: boolean }[];
  effectCount: number;
  returnTag: string;
}

export interface SourceAnalysis {
  components: ComponentAnalysis[];
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  noResolve: true,
  skipLibCheck: true,
};

const SCALAR_DART_TYPES: Record<string, string> = {
  boolean: 'bool',
  string: 'String',
  number: 'double',
};

const createProgramFor = (source: string, filePath: string): ts.Program => {
  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const defaultReadFile = host.readFile.bind(host);
  const defaultFileExists = host.fileExists.bind(host);
  host.readFile = (fileName): string | undefined =>
    fileName === filePath ? source : defaultReadFile(fileName);
  host.fileExists = (fileName): boolean =>
    fileName === filePath ? true : defaultFileExists(fileName);
  return ts.createProgram([filePath], COMPILER_OPTIONS, host);
};

const importedHookModules = (
  sourceFile: ts.SourceFile,
): Map<string, string> => {
  const modules = new Map<string, string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) {
      continue;
    }
    for (const element of bindings.elements) {
      modules.set(element.name.text, statement.moduleSpecifier.text);
    }
  }
  return modules;
};

const dartTypeOfInitial = (
  checker: ts.TypeChecker,
  initializer: ts.Expression,
): string => {
  if (ts.isNumericLiteral(initializer)) {
    return initializer.text.includes('.') ? 'double' : 'int';
  }
  const literalType = checker.getTypeAtLocation(initializer);
  const widened = checker.getBaseTypeOfLiteralType(literalType);
  const typeText = checker.typeToString(widened);
  return SCALAR_DART_TYPES[typeText] ?? typeText;
};

const unwrapParentheses = (expression: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(expression)
    ? unwrapParentheses(expression.expression)
    : expression;

const jsxRootTag = (expression: ts.Expression): string | null => {
  if (ts.isJsxElement(expression)) {
    return expression.openingElement.tagName.getText();
  }
  if (ts.isJsxSelfClosingElement(expression)) {
    return expression.tagName.getText();
  }
  return null;
};

const returnedJsx = (body: ts.ConciseBody): ts.Expression | null => {
  if (!ts.isBlock(body)) {
    const expression = unwrapParentheses(body);
    return jsxRootTag(expression) === null ? null : expression;
  }
  for (const statement of body.statements) {
    if (ts.isReturnStatement(statement) && statement.expression !== undefined) {
      const expression = unwrapParentheses(statement.expression);
      if (jsxRootTag(expression) !== null) {
        return expression;
      }
    }
  }
  return null;
};

interface BodyContext {
  sourceFile: ts.SourceFile;
  checker: ts.TypeChecker;
  hookModules: Map<string, string>;
  analysis: ComponentAnalysis;
}

const analyzeStateDeclaration = (
  declaration: ts.VariableDeclaration,
  call: ts.CallExpression,
  context: BodyContext,
): void => {
  const { name } = declaration;
  if (!ts.isArrayBindingPattern(name) || name.elements.length !== 2) {
    throw tsxErrorAt(
      'TSX0102',
      'useState must be destructured as ' +
        '`const [value, setValue] = useState(...)`.',
      { sourceFile: context.sourceFile, node: declaration.name },
    );
  }
  const [valueElement, setterElement] = name.elements;
  const initializer = call.arguments[0];
  if (
    valueElement === undefined ||
    setterElement === undefined ||
    !ts.isBindingElement(valueElement) ||
    !ts.isBindingElement(setterElement) ||
    initializer === undefined
  ) {
    throw tsxErrorAt(
      'TSX0102',
      'useState must be destructured as ' +
        '`const [value, setValue] = useState(...)`.',
      { sourceFile: context.sourceFile, node: declaration.name },
    );
  }
  context.analysis.states.push({
    name: valueElement.name.getText(),
    setterName: setterElement.name.getText(),
    initialText: initializer.getText(),
    dartType: dartTypeOfInitial(context.checker, initializer),
    initializer,
  });
};

const analyzeBodyStatement = (
  statement: ts.Statement,
  context: BodyContext,
): void => {
  if (ts.isExpressionStatement(statement)) {
    const call = statement.expression;
    if (
      ts.isCallExpression(call) &&
      ts.isIdentifier(call.expression) &&
      call.expression.text === 'useEffect'
    ) {
      context.analysis.effects.push(call);
    }
    return;
  }

  if (!ts.isVariableStatement(statement)) {
    return;
  }
  for (const declaration of statement.declarationList.declarations) {
    const { initializer } = declaration;
    if (initializer === undefined) {
      continue;
    }
    if (ts.isArrowFunction(initializer)) {
      context.analysis.handlers.push({
        name: declaration.name.getText(),
        isAsync:
          initializer.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
          ) ?? false,
        body: initializer,
      });
      continue;
    }
    if (
      ts.isCallExpression(initializer) &&
      ts.isIdentifier(initializer.expression)
    ) {
      const callee = initializer.expression.text;
      if (callee === 'useState') {
        analyzeStateDeclaration(declaration, initializer, context);
      } else if (
        callee.startsWith('use') &&
        context.hookModules.get(callee) === 'flutter-tsx/plugins'
      ) {
        context.analysis.plugins.push({
          binding: declaration.name.getText(),
          hook: callee,
          call: initializer,
        });
      }
    }
  }
};

const analyzeComponent = (
  name: string,
  arrow: ts.ArrowFunction,
  context: Omit<BodyContext, 'analysis'>,
): ComponentAnalysis | null => {
  const returnJsx = returnedJsx(arrow.body);
  if (returnJsx === null) {
    return null;
  }

  const analysis: ComponentAnalysis = {
    name,
    states: [],
    plugins: [],
    handlers: [],
    effects: [],
    returnJsx,
    sourceFile: context.sourceFile,
  };
  if (ts.isBlock(arrow.body)) {
    for (const statement of arrow.body.statements) {
      analyzeBodyStatement(statement, { ...context, analysis });
    }
  }
  return analysis;
};

export const requireSourceFile = (
  program: ts.Program,
  filePath: string,
): ts.SourceFile => {
  const sourceFile = program.getSourceFile(filePath);
  if (sourceFile === undefined) {
    throw new TsxError('TSX0100', `could not parse ${filePath}`, {
      file: filePath,
      line: 1,
      column: 1,
    });
  }
  return sourceFile;
};

export const analyzeSource = (
  source: string,
  filePath: string,
): SourceAnalysis => {
  const program = createProgramFor(source, filePath);
  const sourceFile = requireSourceFile(program, filePath);
  const checker = program.getTypeChecker();
  const hookModules = importedHookModules(sourceFile);

  const components: ComponentAnalysis[] = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) !== true
    ) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        declaration.initializer === undefined ||
        !ts.isArrowFunction(declaration.initializer)
      ) {
        continue;
      }
      const component = analyzeComponent(
        declaration.name.getText(),
        declaration.initializer,
        { sourceFile, checker, hookModules },
      );
      if (component !== null) {
        components.push(component);
      }
    }
  }

  if (components.length === 0) {
    throw new TsxError(
      'TSX0103',
      'no exported component found: export a const arrow function that ' +
        'returns JSX.',
      { file: filePath, line: 1, column: 1 },
    );
  }
  return { components, checker, sourceFile };
};

export const summarize = (component: ComponentAnalysis): ComponentSummary => ({
  name: component.name,
  states: component.states.map(
    ({ name, setterName, initialText, dartType }) => ({
      name,
      setterName,
      initialText,
      dartType,
    }),
  ),
  plugins: component.plugins.map(({ binding, hook }) => ({ binding, hook })),
  handlers: component.handlers.map(({ name, isAsync }) => ({ name, isAsync })),
  effectCount: component.effects.length,
  returnTag: jsxRootTag(component.returnJsx) ?? '',
});
