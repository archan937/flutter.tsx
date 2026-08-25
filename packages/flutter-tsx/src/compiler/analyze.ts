import ts from 'typescript';

import { TsxError, tsxErrorAt } from './diagnostics';

export interface StateBinding {
  name: string;
  setterName: string;
  initialText: string;
  dartType: string;
  mutable: boolean;
  initializer: ts.Expression;
}

export interface PluginBinding {
  binding: string;
  hook: string;
  package: string;
  call: ts.CallExpression;
}

export interface HandlerBinding {
  name: string;
  isAsync: boolean;
  body: ts.ArrowFunction;
}

export interface PropBinding {
  name: string;
  dartType: string;
  required: boolean;
}

export interface ComponentAnalysis {
  name: string;
  nameNode: ts.Node;
  exported: boolean;
  props: PropBinding[];
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
  plugins: { binding: string; hook: string; package: string }[];
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

const PLUGIN_MODULE_PREFIX = 'plugin:';

const SCALAR_DART_TYPES: Record<string, string> = {
  boolean: 'bool',
  string: 'String',
  number: 'double',
};

const PROP_DART_TYPES = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.StringKeyword, 'String'],
  [ts.SyntaxKind.NumberKeyword, 'double'],
  [ts.SyntaxKind.BooleanKeyword, 'bool'],
]);

const propsError = (sourceFile: ts.SourceFile, node: ts.Node): never => {
  throw tsxErrorAt(
    'TSX0309',
    'props must be destructured with an inline type: ' +
      '`({ name }: { name: string })` (named prop types land at roadmap ' +
      'step 21).',
    { sourceFile, node },
  );
};

const localTypeMembers = (
  name: string,
  sourceFile: ts.SourceFile,
): readonly ts.TypeElement[] | null => {
  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === name) {
      return statement.members;
    }
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === name &&
      ts.isTypeLiteralNode(statement.type)
    ) {
      return statement.type.members;
    }
  }
  return null;
};

const propsTypeMembers = (
  annotation: ts.TypeNode,
  sourceFile: ts.SourceFile,
): readonly ts.TypeElement[] | null => {
  if (ts.isTypeLiteralNode(annotation)) {
    return annotation.members;
  }
  if (
    ts.isTypeReferenceNode(annotation) &&
    ts.isIdentifier(annotation.typeName)
  ) {
    return localTypeMembers(annotation.typeName.text, sourceFile);
  }
  return null;
};

const analyzeProps = (
  arrow: ts.ArrowFunction,
  sourceFile: ts.SourceFile,
): PropBinding[] => {
  const [parameter] = arrow.parameters;
  if (parameter === undefined) {
    return [];
  }
  const annotation = parameter.type;
  const members =
    annotation === undefined ? null : propsTypeMembers(annotation, sourceFile);
  if (!ts.isObjectBindingPattern(parameter.name) || annotation === undefined) {
    return propsError(sourceFile, parameter.name);
  }
  if (members === null) {
    return propsError(sourceFile, annotation);
  }
  return members.map((member) => {
    if (
      !ts.isPropertySignature(member) ||
      !ts.isIdentifier(member.name) ||
      member.type === undefined
    ) {
      return propsError(sourceFile, member);
    }
    const dartType = PROP_DART_TYPES.get(member.type.kind);
    if (dartType === undefined) {
      return propsError(sourceFile, member.type);
    }
    return {
      name: member.name.text,
      dartType,
      required: member.questionToken === undefined,
    };
  });
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
  sourceFile: ts.SourceFile,
): string => {
  if (ts.isNumericLiteral(initializer)) {
    return initializer.text.includes('.') ? 'double' : 'int';
  }
  if (ts.isArrayLiteralExpression(initializer)) {
    const elementTypes = new Set(
      initializer.elements.map((element) =>
        dartTypeOfInitial(checker, element, sourceFile),
      ),
    );
    const [only] = elementTypes;
    if (elementTypes.size !== 1 || only === undefined) {
      throw tsxErrorAt(
        'TSX0308',
        'cannot infer the element type of this list state from an empty ' +
          'literal.',
        { sourceFile, node: initializer },
      );
    }
    return `List<${only}>`;
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
  if (ts.isJsxFragment(expression)) {
    return '<>';
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
  if (
    !ts.isArrayBindingPattern(name) ||
    name.elements.length < 1 ||
    name.elements.length > 2
  ) {
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
    !ts.isBindingElement(valueElement) ||
    (setterElement !== undefined && !ts.isBindingElement(setterElement)) ||
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
    setterName:
      setterElement !== undefined && ts.isBindingElement(setterElement)
        ? setterElement.name.getText()
        : '',
    initialText: initializer.getText(),
    dartType: dartTypeOfInitial(
      context.checker,
      initializer,
      context.sourceFile,
    ),
    mutable: false,
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
      const module = context.hookModules.get(callee);
      if (callee === 'useState') {
        analyzeStateDeclaration(declaration, initializer, context);
      } else if (
        callee.startsWith('use') &&
        module?.startsWith(PLUGIN_MODULE_PREFIX) === true
      ) {
        context.analysis.plugins.push({
          binding: declaration.name.getText(),
          hook: callee,
          package: module.slice(PLUGIN_MODULE_PREFIX.length),
          call: initializer,
        });
      }
    }
  }
};

const analyzeComponent = (
  nameNode: ts.BindingName,
  arrow: ts.ArrowFunction,
  context: Omit<BodyContext, 'analysis'> & { exported: boolean },
): ComponentAnalysis | null => {
  const returnJsx = returnedJsx(arrow.body);
  if (returnJsx === null) {
    return null;
  }

  const analysis: ComponentAnalysis = {
    name: nameNode.getText(),
    nameNode,
    exported: context.exported,
    props: analyzeProps(arrow, context.sourceFile),
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
  for (const state of analysis.states) {
    state.mutable =
      state.setterName !== '' &&
      identifierCount(arrow.body, state.setterName) >= 2;
  }
  return analysis;
};

// The destructuring binding itself is one occurrence — a setter is used
// only when it appears again somewhere in the body.
const identifierCount = (root: ts.Node, name: string): number => {
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === name) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return count;
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
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    const exported =
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) === true;
    for (const declaration of statement.declarationList.declarations) {
      if (
        declaration.initializer === undefined ||
        !ts.isArrowFunction(declaration.initializer)
      ) {
        continue;
      }
      const component = analyzeComponent(
        declaration.name,
        declaration.initializer,
        {
          sourceFile,
          checker,
          hookModules,
          exported,
        },
      );
      if (component !== null) {
        components.push(component);
      }
    }
  }

  if (!components.some((component) => component.exported)) {
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
  plugins: component.plugins.map(({ binding, hook, package: pubPackage }) => ({
    binding,
    hook,
    package: pubPackage,
  })),
  handlers: component.handlers.map(({ name, isAsync }) => ({ name, isAsync })),
  effectCount: component.effects.length,
  returnTag: jsxRootTag(component.returnJsx) ?? '',
});
