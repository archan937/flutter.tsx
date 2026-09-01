import ts from 'typescript';

import { escapeDartString } from './dart-print';
import { TsxError, tsxErrorAt } from './diagnostics';
import { checkStrictMode } from './strict-mode';

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

/// One `await useAsync(load, { loading, error })` per component: the data
/// name binds the resolved value inside the generated FutureBuilder.
export interface AsyncBinding {
  // `useAsync` builds a FutureBuilder, `useStream` a StreamBuilder.
  hook: 'useAsync' | 'useStream';
  name: string;
  load: ts.Expression;
  loadingJsx: ts.Expression;
  errorParam: string;
  errorJsx: ts.Expression;
}

/// A module-level `createStore({ … })`: one ChangeNotifier per store.
export interface StoreBinding {
  name: string;
  fields: { name: string; dartType: string; initialText: string }[];
}

/// `const [state, setState] = useStore(someStore)` inside a component.
export interface StoreUse {
  storeName: string;
  stateName: string;
  setterName: string;
}

/// `createRouter({ '/': Home })` — one route table per file.
export interface RouterBinding {
  name: string;
  routes: { path: string; component: string }[];
}

/// A data model generated from a TS interface: one Dart class with a
/// `fromJson` factory.
export interface ModelBinding {
  name: string;
  fields: { name: string; dartType: string; required: boolean }[];
}

/// A TypeScript `enum`, which at runtime is a namespace of constants.
export interface EnumBinding {
  name: string;
  dartType: 'String' | 'int';
  members: { name: string; dartName: string; value: string }[];
}

/// A module-level `const f = (a: T): R => …` the file's components call.
export interface HelperParam {
  name: string;
  dartType: string;
  /// A literal default, which Dart writes as an optional positional.
  defaultValue: string | null;
}

export interface HelperBinding {
  name: string;
  /// `<T>` on the helper, kept so the Dart signature stays generic.
  typeParams: string[];
  params: HelperParam[];
  returnDartType: string;
  /** One expression, or a block with its own locals and returns. */
  body: ts.ConciseBody;
}

/**
 * `const query = new TextEditingController()` in a component body.
 *
 * The component owns it: made when the widget mounts, disposed when it goes.
 * Which classes qualify is the compiler's to say — the analyzer records every
 * `new` here and the lowering keeps the ones that are controllers.
 */
export interface ControllerBinding {
  name: string;
  className: string;
  node: ts.NewExpression;
}

/// `const x = <expression>` in a component body, kept in source order.
export interface LocalBinding {
  name: string;
  expression: ts.Expression;
  /// The declared type, when written: `const album: Album = json(…)`.
  declaredType: string | null;
}

export interface HandlerBinding {
  name: string;
  isAsync: boolean;
  /** The values the callback is handed, with the Dart type each declares. */
  params: { name: string; dartType: string }[];
  body: ts.ArrowFunction;
}

export interface PropBinding {
  name: string;
  dartType: string;
  required: boolean;
}

/**
 * An early return: `if (!info) return <Text>Loading…</Text>;`.
 *
 * A component guards before it renders — the React shape newcomers already
 * write, and the only honest way to read a value the hook has not built yet.
 */
export interface GuardBinding {
  condition: ts.Expression;
  jsx: ts.Expression;
}

export interface ComponentAnalysis {
  name: string;
  nameNode: ts.Node;
  exported: boolean;
  props: PropBinding[];
  states: StateBinding[];
  plugins: PluginBinding[];
  asyncBinding: AsyncBinding | null;
  storeUse: StoreUse | null;
  /// Names bound by `useNavigation()` in this component.
  navigators: string[];
  locals: LocalBinding[];
  handlers: HandlerBinding[];
  helpers: HelperBinding[];
  effects: ts.CallExpression[];
  controllers: ControllerBinding[];
  guards: GuardBinding[];
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

/**
 * `export const ALBUMS: Album[] = [ … ]` — data the module declares.
 *
 * An app has lookup tables, seed data and settings before it has a server,
 * and they belong beside the code that reads them. A typed const with a
 * literal for a value becomes a top-level Dart constant.
 */
export interface ConstantBinding {
  name: string;
  dartType: string;
  expression: ts.Expression;
}

export interface SourceAnalysis {
  components: ComponentAnalysis[];
  constants: ConstantBinding[];
  stores: StoreBinding[];
  router: RouterBinding | null;
  models: ModelBinding[];
  helpers: HelperBinding[];
  enums: EnumBinding[];
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  /// local name -> which package it came from and what it is called there
  pluginImports: Map<string, { package: string; exportedName: string }>;
  /// local name -> the relative module it was imported from, for components
  /// this file uses but another file declares
  componentImports: Map<string, string>;
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  jsx: ts.JsxEmit.ReactJSX,
  noResolve: true,
  skipLibCheck: true,
};

const PLUGIN_MODULE_PREFIX = 'plugin:';

/**
 * TypeScript's `number` is Dart's `num`.
 *
 * It is the type that holds either of Dart's, which is what a TypeScript
 * number is: `1994` stays `1994` when it is printed, where a `double` would
 * print `1994.0`. Where a Flutter API asks for a `double` specifically, the
 * value is widened at that boundary — see `widenedNumberDart`.
 */
const SCALAR_DART_TYPES: Record<string, string> = {
  boolean: 'bool',
  string: 'String',
  number: 'num',
};

const PROP_DART_TYPES = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.StringKeyword, 'String'],
  [ts.SyntaxKind.NumberKeyword, 'num'],
  [ts.SyntaxKind.BooleanKeyword, 'bool'],
]);

/**
 * The Dart type a prop annotation maps to: a scalar, a list of those, or a
 * model this file declares. Null when nothing maps.
 */
const dartPropType = (
  type: ts.TypeNode,
  sourceFile: ts.SourceFile,
  typeParams: Set<string> = new Set(),
): string | null => {
  const scalar = PROP_DART_TYPES.get(type.kind);
  if (scalar !== undefined) return scalar;
  if (ts.isArrayTypeNode(type)) {
    const element = dartPropType(type.elementType, sourceFile, typeParams);
    return element === null ? null : `List<${element}>`;
  }
  if (ts.isTupleTypeNode(type)) {
    const members = type.elements.map((element) =>
      dartPropType(element, sourceFile, typeParams),
    );
    return members.every((member) => member !== null)
      ? `(${members.join(', ')})`
      : null;
  }
  if (
    ts.isUnionTypeNode(type) &&
    type.types.every(
      (member) =>
        ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal),
    )
  ) {
    return 'String';
  }
  if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
    if (typeParams.has(type.typeName.text)) {
      return type.typeName.text;
    }
    const declaredEnum = enumDeclaration(type.typeName.text, sourceFile);
    if (declaredEnum !== null) {
      return declaredEnum;
    }
    if (localTypeMembers(type.typeName.text, sourceFile) !== null) {
      return type.typeName.text;
    }
    // A model declared in another file of this project: the Dart class is
    // emitted there, and this file imports it.
    if (relativeTypeImports(sourceFile).has(type.typeName.text)) {
      return type.typeName.text;
    }
  }
  return null;
};

/** Names this file imports from a sibling module, by the module they came from. */
export const relativeTypeImports = (
  sourceFile: ts.SourceFile,
): Map<string, string> => {
  const imports = new Map<string, string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.startsWith('.')
    ) {
      continue;
    }
    const bindings = statement.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      imports.set(element.name.text, statement.moduleSpecifier.text);
    }
  }
  return imports;
};

/** The Dart type an enum's members hold, when this names an enum. */
const enumDeclaration = (
  name: string,
  sourceFile: ts.SourceFile,
): 'String' | 'int' | null => {
  for (const statement of sourceFile.statements) {
    if (ts.isEnumDeclaration(statement) && statement.name.text === name) {
      return statement.members.some(
        (member) =>
          member.initializer !== undefined &&
          ts.isStringLiteral(member.initializer),
      )
        ? 'String'
        : 'int';
    }
  }
  return null;
};

const propsError = (sourceFile: ts.SourceFile, node: ts.Node): never => {
  throw tsxErrorAt(
    'TSX0309',
    'props must be destructured, and their type must be an object type: ' +
      '`({ name }: { name: string })` or an interface declared in this file.',
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
    const dartType = dartPropType(member.type, sourceFile);
    if (dartType === null) {
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

interface ImportedNames {
  /// local name -> module specifier
  modules: Map<string, string>;
  /// local name -> the name the module exports
  originals: Map<string, string>;
}

const importedHookModules = (sourceFile: ts.SourceFile): ImportedNames => {
  const modules = new Map<string, string>();
  const originalNames = new Map<string, string>();
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
      // `import { get as httpGet }` binds httpGet locally but names get in
      // the module, and the plugin API is keyed by the module's name.
      modules.set(element.name.text, statement.moduleSpecifier.text);
      originalNames.set(
        element.name.text,
        (element.propertyName ?? element.name).text,
      );
    }
  }
  return { modules, originals: originalNames };
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
  storeNames: ReadonlySet<string>;
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

/** Claims a statement of a component's body, or reports it unclaimed. */
const analyzeBodyStatement = (
  statement: ts.Statement,
  context: BodyContext,
): boolean => {
  if (ts.isReturnStatement(statement)) {
    return true;
  }
  if (ts.isIfStatement(statement)) {
    return analyzeGuard(statement, context);
  }
  if (ts.isExpressionStatement(statement)) {
    const call = statement.expression;
    if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) {
      return false;
    }
    const callee = call.expression.text;
    if (callee === 'useEffect') {
      context.analysis.effects.push(call);
      return true;
    }
    // `useTrayManager({ onTrayIconMouseDown: … })` — a component that only
    // wants the events has nothing to bind, and the callbacks it wrote must
    // not be quietly dropped.
    const module = context.hookModules.get(callee);
    if (
      callee.startsWith('use') &&
      module?.startsWith(PLUGIN_MODULE_PREFIX) === true
    ) {
      context.analysis.plugins.push({
        binding: lowerFirstLetter(callee.slice('use'.length)),
        hook: callee,
        package: module.slice(PLUGIN_MODULE_PREFIX.length),
        call,
      });
      return true;
    }
    return false;
  }

  if (!ts.isVariableStatement(statement)) {
    return false;
  }
  for (const declaration of statement.declarationList.declarations) {
    const { initializer } = declaration;
    if (initializer === undefined) {
      continue;
    }
    if (ts.isAwaitExpression(initializer)) {
      analyzeAsyncDeclaration(declaration, initializer, context);
      continue;
    }
    // A local arrow that declares a return type is a helper, not a callback:
    // it computes something the component renders.
    if (ts.isArrowFunction(initializer) && initializer.type !== undefined) {
      context.analysis.helpers.push(
        helperBinding(
          declaration.name.getText(),
          initializer,
          context.sourceFile,
        ),
      );
      continue;
    }
    if (ts.isArrowFunction(initializer)) {
      context.analysis.handlers.push({
        name: declaration.name.getText(),
        isAsync:
          initializer.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
          ) ?? false,
        params: handlerParams(initializer, context.sourceFile),
        body: initializer,
      });
      continue;
    }
    // `const scroll = new ScrollController()` — a value the component owns
    // rather than a local it rebuilds.
    if (
      ts.isNewExpression(initializer) &&
      ts.isIdentifier(initializer.expression)
    ) {
      context.analysis.controllers.push({
        name: declaration.name.getText(),
        className: initializer.expression.text,
        node: initializer,
      });
      continue;
    }
    // A cast wraps the call — `json(res.body) as Album` — so dispatch on what
    // is underneath while the local keeps the original expression.
    const called = ts.isAsExpression(initializer)
      ? initializer.expression
      : initializer;
    if (!ts.isCallExpression(called) || !ts.isIdentifier(called.expression)) {
      // Anything else is a plain local: `const doubled = count * 2;`. It must
      // be recorded, or the generated Dart would reference a name it never
      // declares.
      context.analysis.locals.push({
        name: declaration.name.getText(),
        expression: initializer,
        declaredType: declaredTypeName(declaration),
      });
      continue;
    }
    {
      const callee = called.expression.text;
      const module = context.hookModules.get(callee);
      if (callee === 'useState') {
        analyzeStateDeclaration(declaration, called, context);
      } else if (callee === 'useNavigation') {
        context.analysis.navigators.push(declaration.name.getText());
      } else if (callee === 'useStore') {
        analyzeStoreUse(declaration, called, context);
      } else if (
        callee.startsWith('use') &&
        module?.startsWith(PLUGIN_MODULE_PREFIX) === true
      ) {
        context.analysis.plugins.push({
          binding: declaration.name.getText(),
          hook: callee,
          package: module.slice(PLUGIN_MODULE_PREFIX.length),
          call: called,
        });
      } else {
        // Any other call is a plain local, e.g. `const album = json<Album>(…)`.
        context.analysis.locals.push({
          name: declaration.name.getText(),
          expression: initializer,
          declaredType: declaredTypeName(declaration),
        });
      }
    }
  }
  return true;
};

/** `if (cond) return <jsx>;` — anything else in an `if` is not a guard. */
const analyzeGuard = (
  statement: ts.IfStatement,
  context: BodyContext,
): boolean => {
  if (statement.elseStatement !== undefined) {
    return false;
  }
  const returned = ts.isBlock(statement.thenStatement)
    ? statement.thenStatement.statements.at(0)
    : statement.thenStatement;
  if (
    returned === undefined ||
    !ts.isReturnStatement(returned) ||
    returned.expression === undefined
  ) {
    return false;
  }
  const jsx = unwrapParentheses(returned.expression);
  if (jsxRootTag(jsx) === null) {
    return false;
  }
  context.analysis.guards.push({ condition: statement.expression, jsx });
  return true;
};

// `const data = await useAsync(load, { loading, error })`
const analyzeAsyncDeclaration = (
  declaration: ts.VariableDeclaration,
  awaited: ts.AwaitExpression,
  context: BodyContext,
): void => {
  const call = awaited.expression;
  const hook =
    ts.isCallExpression(call) && ts.isIdentifier(call.expression)
      ? call.expression.text
      : '';
  if (
    !ts.isCallExpression(call) ||
    (hook !== 'useAsync' && hook !== 'useStream')
  ) {
    throw tsxErrorAt(
      'TSX0305',
      'only `useAsync` and `useStream` can be awaited in a component.',
      { sourceFile: context.sourceFile, node: awaited },
    );
  }
  if (context.analysis.asyncBinding !== null) {
    throw tsxErrorAt(
      'TSX0318',
      `a component compiles one \`${hook}\`; move the second into a child ` +
        'component.',
      { sourceFile: context.sourceFile, node: declaration.name },
    );
  }
  const [load, options] = call.arguments;
  if (
    load === undefined ||
    !ts.isArrowFunction(load) ||
    ts.isBlock(load.body) ||
    options === undefined ||
    !ts.isObjectLiteralExpression(options)
  ) {
    throw tsxErrorAt(
      'TSX0320',
      `\`${hook}\` takes an arrow returning the source and an options ` +
        `object: \`${hook}(() => load(), { loading, error })\`.`,
      { sourceFile: context.sourceFile, node: call },
    );
  }
  const loading = asyncFallback(options, 'loading');
  const error = asyncFallback(options, 'error');
  if (loading === null || error === null) {
    throw tsxErrorAt(
      'TSX0319',
      `\`${hook}\` needs both a \`loading\` and an \`error\` fallback: ` +
        'every builder state must render something.',
      { sourceFile: context.sourceFile, node: declaration.name },
    );
  }
  const [errorParam] = error.parameters;
  context.analysis.asyncBinding = {
    hook,
    name: declaration.name.getText(),
    load: load.body,
    loadingJsx: loading.body as ts.Expression,
    errorParam: errorParam?.name.getText() ?? 'error',
    errorJsx: error.body as ts.Expression,
  };
};

const asyncFallback = (
  options: ts.ObjectLiteralExpression,
  key: string,
): ts.ArrowFunction | null => {
  for (const property of options.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === key &&
      ts.isArrowFunction(property.initializer) &&
      !ts.isBlock(property.initializer.body)
    ) {
      return property.initializer;
    }
  }
  return null;
};

const analyzeStoreUse = (
  declaration: ts.VariableDeclaration,
  call: ts.CallExpression,
  context: BodyContext,
): void => {
  const { name } = declaration;
  const [store] = call.arguments;
  // A component that only reads the store writes `const [state] = …`, which
  // is as ordinary as reading state without setting it.
  if (
    !ts.isArrayBindingPattern(name) ||
    name.elements.length < 1 ||
    name.elements.length > 2 ||
    store === undefined ||
    !ts.isIdentifier(store)
  ) {
    throw tsxErrorAt(
      'TSX0324',
      '`useStore` must be destructured as ' +
        '`const [state, setState] = useStore(someStore)`, or ' +
        '`const [state]` to read it.',
      { sourceFile: context.sourceFile, node: declaration.name },
    );
  }
  if (!context.storeNames.has(store.text)) {
    throw tsxErrorAt(
      'TSX0322',
      `\`${store.text}\` is not a store: create one with ` +
        '`createStore({ … })`, here or in a file this one imports.',
      { sourceFile: context.sourceFile, node: store },
    );
  }
  // `const [state, setState]`, `const [state]` to read, `const [, setState]`
  // to write: whichever halves the component actually uses.
  const [stateElement, setterElement] = name.elements;
  const named = (element: ts.ArrayBindingElement | undefined): boolean =>
    element !== undefined && ts.isBindingElement(element);
  if (!named(stateElement) && !named(setterElement)) {
    throw tsxErrorAt(
      'TSX0324',
      '`useStore` must be destructured as ' +
        '`const [state, setState] = useStore(someStore)`, or ' +
        '`const [state]` to read it.',
      { sourceFile: context.sourceFile, node: declaration.name },
    );
  }
  context.analysis.storeUse = {
    storeName: store.text,
    stateName:
      stateElement !== undefined && ts.isBindingElement(stateElement)
        ? stateElement.name.getText()
        : '',
    setterName:
      setterElement !== undefined && ts.isBindingElement(setterElement)
        ? setterElement.name.getText()
        : '',
  };
};

// Only the literal shapes the compiler can turn into typed Dart fields; a
// `new Date()` or a nested object would silently lose its type otherwise. The
// syntax kind settles the type, so no type checker is involved.
const storeFieldType = (
  initializer: ts.Expression,
  sourceFile: ts.SourceFile,
): string => {
  if (ts.isNumericLiteral(initializer)) {
    return initializer.text.includes('.') ? 'double' : 'int';
  }
  if (ts.isStringLiteral(initializer)) {
    return 'String';
  }
  if (
    initializer.kind === ts.SyntaxKind.TrueKeyword ||
    initializer.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return 'bool';
  }
  throw tsxErrorAt(
    'TSX0323',
    'a store field needs a literal the compiler can type: string, number ' +
      'or boolean.',
    { sourceFile, node: initializer },
  );
};

// The route table names components declared in the same file, so a typo or a
// string in place of a component is caught here rather than in Dart.
const analyzeRouter = (
  sourceFile: ts.SourceFile,
  componentNames: ReadonlySet<string>,
): RouterBinding | null => {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      const { initializer } = declaration;
      if (
        initializer === undefined ||
        !ts.isCallExpression(initializer) ||
        !ts.isIdentifier(initializer.expression) ||
        initializer.expression.text !== 'createRouter'
      ) {
        continue;
      }
      const [table] = initializer.arguments;
      if (table === undefined || !ts.isObjectLiteralExpression(table)) {
        throw tsxErrorAt(
          'TSX0327',
          '`createRouter` takes a table of paths to components: ' +
            "`createRouter({ '/': Home })`.",
          { sourceFile, node: initializer },
        );
      }
      return {
        name: declaration.name.getText(),
        routes: table.properties.map((property) => {
          if (
            !ts.isPropertyAssignment(property) ||
            !ts.isStringLiteral(property.name)
          ) {
            throw tsxErrorAt(
              'TSX0327',
              '`createRouter` takes a table of paths to components: ' +
                "`createRouter({ '/': Home })`.",
              { sourceFile, node: property },
            );
          }
          const target = property.initializer;
          // A page usually lives in its own file, so a route points at a
          // component declared here or imported from next door.
          if (!ts.isIdentifier(target) || !componentNames.has(target.text)) {
            throw tsxErrorAt(
              'TSX0328',
              'a route must point at a component: one declared in this file, ' +
                'or one imported from a sibling file.',
              { sourceFile, node: target },
            );
          }
          return { path: property.name.text, component: target.text };
        }),
      };
    }
  }
  return null;
};

// A TS interface maps to a Dart data class. `number` becomes `num`, not
// `double`: JSON carries both integers and doubles, and `as double` throws on
// an integer value, so num is the only safe cast without a distinct int type
// in TSX.
const MODEL_SCALARS: Record<string, string> = {
  string: 'String',
  number: 'num',
  boolean: 'bool',
};

// The model is named either by an `as` cast — how TypeScript normally types a
// parsed body — or by an annotation on the declaration.
const typeReferenceName = (annotation: ts.TypeNode): string | null =>
  ts.isTypeReferenceNode(annotation) && ts.isIdentifier(annotation.typeName)
    ? annotation.typeName.text
    : null;

const declaredTypeName = (
  declaration: ts.VariableDeclaration,
): string | null => {
  const { initializer, type } = declaration;
  if (initializer !== undefined && ts.isAsExpression(initializer)) {
    return typeReferenceName(initializer.type);
  }
  return type === undefined ? null : typeReferenceName(type);
};

const referencedModel = (annotation: ts.TypeNode): string | null => {
  if (ts.isArrayTypeNode(annotation)) {
    return referencedModel(annotation.elementType);
  }
  return ts.isTypeReferenceNode(annotation) &&
    ts.isIdentifier(annotation.typeName)
    ? annotation.typeName.text
    : null;
};

const modelFieldType = (
  annotation: ts.TypeNode,
  known: ReadonlySet<string>,
): string | null => {
  if (ts.isArrayTypeNode(annotation)) {
    const item = modelFieldType(annotation.elementType, known);
    return item === null ? null : `List<${item}>`;
  }
  if (
    ts.isTypeReferenceNode(annotation) &&
    ts.isIdentifier(annotation.typeName)
  ) {
    return known.has(annotation.typeName.text)
      ? annotation.typeName.text
      : null;
  }
  const keyword = MODEL_SCALARS[annotation.getText()];
  return keyword ?? null;
};

// Only an interface actually decoded with `json(…) as Model` becomes a Dart
// data class — plus whatever such an interface references. A props interface
// is still just a props interface, and is neither emitted nor validated as a
// model.
const isJsonCall = (expression: ts.Expression): boolean =>
  ts.isCallExpression(expression) &&
  ts.isIdentifier(expression.expression) &&
  expression.expression.text === 'json';

/** Exported interfaces and object type aliases, by name. */
const exportedShapeNames = (sourceFile: ts.SourceFile): string[] =>
  sourceFile.statements.flatMap((statement) => {
    const exported =
      ts.canHaveModifiers(statement) &&
      (ts.getModifiers(statement) ?? []).some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
    if (!exported) return [];
    if (ts.isInterfaceDeclaration(statement)) return [statement.name.text];
    return ts.isTypeAliasDeclaration(statement) &&
      ts.isTypeLiteralNode(statement.type)
      ? [statement.name.text]
      : [];
  });

const jsonTargetNames = (sourceFile: ts.SourceFile): Set<string> => {
  const targets = new Set<string>();
  const visit = (node: ts.Node): void => {
    // A decode is a decode wherever it is written — a local, a helper body,
    // an argument, or straight into a child.
    if (
      ts.isAsExpression(node) &&
      isJsonCall(node.expression) &&
      ts.isTypeReferenceNode(node.type)
    ) {
      targets.add(node.type.typeName.getText());
    }
    if (ts.isVariableDeclaration(node)) {
      const { initializer } = node;
      const decoded =
        initializer !== undefined &&
        (isJsonCall(initializer) ||
          (ts.isAsExpression(initializer) &&
            isJsonCall(initializer.expression)));
      const named = decoded ? declaredTypeName(node) : null;
      if (named !== null) {
        targets.add(named);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return targets;
};

const LIST_DART_TYPE = /^List<(.*)>$/;

/**
 * The type a prop's Dart type ultimately names: `List<List<Job>>` is a Job.
 * A props object destructured into constructor parameters names nothing.
 */
const namedDartType = (dartType: string): string => {
  const list = LIST_DART_TYPE.exec(dartType);
  return list?.[1] === undefined ? dartType : namedDartType(list[1]);
};

/**
 * Models a component's props require: a prop typed `Job[]` needs a Dart class
 * named Job, whether or not anything decodes one from JSON.
 */
const propModelNames = (components: ComponentAnalysis[]): Set<string> =>
  new Set(
    components.flatMap((component) =>
      component.props.map((prop) => namedDartType(prop.dartType)),
    ),
  );

interface HelperTypeError {
  helper: string;
  detail: string;
  node: ts.Node;
}

const lowerFirstLetter = (value: string): string =>
  value.charAt(0).toLowerCase() + value.slice(1);

/**
 * TypeScript enums are constants at runtime: string members keep their text,
 * unlabelled numeric members count up from the last one, exactly as tsc does.
 */
const analyzeEnums = (sourceFile: ts.SourceFile): EnumBinding[] => {
  const enums: EnumBinding[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isEnumDeclaration(statement)) continue;
    let nextNumber = 0;
    let dartType: 'String' | 'int' = 'int';
    const members = statement.members.map((member) => {
      const name = member.name.getText(sourceFile);
      const { initializer } = member;
      if (initializer === undefined) {
        const value = String(nextNumber);
        nextNumber += 1;
        return { name, dartName: lowerFirstLetter(name), value };
      }
      if (ts.isStringLiteral(initializer)) {
        dartType = 'String';
        return {
          name,
          dartName: lowerFirstLetter(name),
          value: `'${escapeDartString(initializer.text)}'`,
        };
      }
      if (ts.isNumericLiteral(initializer)) {
        nextNumber = Number(initializer.text) + 1;
        return {
          name,
          dartName: lowerFirstLetter(name),
          value: initializer.text,
        };
      }
      throw tsxErrorAt(
        'TSX0340',
        `\`${statement.name.text}.${name}\` must be a string or number literal.`,
        { sourceFile, node: initializer },
      );
    });
    enums.push({ name: statement.name.text, dartType, members });
  }
  return enums;
};

/** A parameter's default, which Dart writes as an optional positional. */
const literalDefault = (
  parameter: ts.ParameterDeclaration,
  helper: string,
  sourceFile: ts.SourceFile,
): string | null => {
  const { initializer } = parameter;
  if (initializer === undefined) return null;
  if (ts.isStringLiteral(initializer)) {
    return `'${escapeDartString(initializer.text)}'`;
  }
  if (ts.isNumericLiteral(initializer)) return initializer.text;
  if (initializer.kind === ts.SyntaxKind.TrueKeyword) return 'true';
  if (initializer.kind === ts.SyntaxKind.FalseKeyword) return 'false';
  return helperTypeError(
    {
      helper,
      detail: `needs a literal default for \`${parameter.name.getText(sourceFile)}\`.`,
      node: initializer,
    },
    sourceFile,
  );
};

const helperTypeError = (
  { helper, detail, node }: HelperTypeError,
  sourceFile: ts.SourceFile,
): never => {
  throw tsxErrorAt('TSX0339', `\`${helper}\` ${detail}`, { sourceFile, node });
};

/**
 * The typed signature of `const f = (a: T): R => …`, read from the
 * annotations rather than inferred, so the Dart signature says exactly what
 * the TSX one does.
 */
const helperBinding = (
  name: string,
  arrow: ts.ArrowFunction,
  sourceFile: ts.SourceFile,
): HelperBinding => {
  const typeParams = (arrow.typeParameters ?? []).map(
    (parameter) => parameter.name.text,
  );
  const annotation = arrow.type;
  if (annotation === undefined) {
    return helperTypeError(
      {
        helper: name,
        detail:
          'needs an explicit return type: `(value: string): string => …`.',
        node: arrow,
      },
      sourceFile,
    );
  }
  const scope = new Set(typeParams);
  const returnDartType = dartPropType(annotation, sourceFile, scope);
  if (returnDartType === null) {
    return helperTypeError(
      {
        helper: name,
        detail: `returns a type with no Dart equivalent: ${annotation.getText(sourceFile)}.`,
        node: annotation,
      },
      sourceFile,
    );
  }
  return {
    name,
    typeParams,
    params: arrow.parameters.map((parameter) => {
      if (parameter.dotDotDotToken !== undefined) {
        return helperTypeError(
          {
            helper: name,
            detail:
              'cannot take a rest parameter: Dart has none — pass a list.',
            node: parameter,
          },
          sourceFile,
        );
      }
      if (!ts.isIdentifier(parameter.name)) {
        return helperTypeError(
          {
            helper: name,
            detail: 'takes plain named parameters: `(value: string)`.',
            node: parameter,
          },
          sourceFile,
        );
      }
      const paramType =
        parameter.type === undefined
          ? null
          : dartPropType(parameter.type, sourceFile, scope);
      if (paramType === null) {
        return helperTypeError(
          {
            helper: name,
            detail: `needs a type for \`${parameter.name.text}\`.`,
            node: parameter,
          },
          sourceFile,
        );
      }
      return {
        name: parameter.name.text,
        dartType: paramType,
        defaultValue: literalDefault(parameter, name, sourceFile),
      };
    }),
    returnDartType,
    body: arrow.body,
  };
};

/** Module-level helpers: the components in this file call them by name. */
const analyzeHelpers = (sourceFile: ts.SourceFile): HelperBinding[] => {
  const helpers: HelperBinding[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const arrow = declaration.initializer;
      if (
        arrow === undefined ||
        !ts.isArrowFunction(arrow) ||
        !ts.isIdentifier(declaration.name) ||
        returnedJsx(arrow.body) !== null
      ) {
        continue;
      }
      helpers.push(helperBinding(declaration.name.text, arrow, sourceFile));
    }
  }
  return helpers;
};

const analyzeModels = (
  sourceFile: ts.SourceFile,
  required: Set<string>,
): ModelBinding[] => {
  // `type Point = { x: number }` describes the same shape an interface does,
  // so both become models.
  const declarations = sourceFile.statements.flatMap(
    (statement): { name: string; members: ts.NodeArray<ts.TypeElement> }[] => {
      if (ts.isInterfaceDeclaration(statement)) {
        return [{ name: statement.name.text, members: statement.members }];
      }
      if (
        ts.isTypeAliasDeclaration(statement) &&
        ts.isTypeLiteralNode(statement.type)
      ) {
        return [{ name: statement.name.text, members: statement.type.members }];
      }
      return [];
    },
  );
  const known = new Set(declarations.map((declaration) => declaration.name));
  // Grow the set until it is closed under references from the targets.
  const wanted = new Set([...jsonTargetNames(sourceFile), ...required]);
  let added = true;
  while (added) {
    added = false;
    for (const declaration of declarations) {
      if (!wanted.has(declaration.name)) {
        continue;
      }
      for (const member of declaration.members) {
        const annotation = ts.isPropertySignature(member)
          ? member.type
          : undefined;
        const referenced =
          annotation === undefined ? null : referencedModel(annotation);
        if (
          referenced !== null &&
          known.has(referenced) &&
          !wanted.has(referenced)
        ) {
          wanted.add(referenced);
          added = true;
        }
      }
    }
  }
  return declarations
    .filter((declaration) => wanted.has(declaration.name))
    .map((declaration) => ({
      name: declaration.name,
      fields: declaration.members.map((member) => {
        const annotation = ts.isPropertySignature(member)
          ? member.type
          : undefined;
        const { name } = member;
        const dartType =
          annotation === undefined ? null : modelFieldType(annotation, known);
        if (dartType === null || name === undefined || !ts.isIdentifier(name)) {
          throw tsxErrorAt(
            'TSX0334',
            `\`${name?.getText() ?? 'this member'}\` has a type the compiler ` +
              'cannot map to Dart: use a string, number, boolean, another ' +
              'interface in this file, or a list of those.',
            { sourceFile, node: member },
          );
        }
        return {
          name: name.text,
          dartType,
          required: member.questionToken === undefined,
        };
      }),
    }));
};

const analyzeStores = (sourceFile: ts.SourceFile): StoreBinding[] => {
  const stores: StoreBinding[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      const { initializer } = declaration;
      if (
        initializer === undefined ||
        !ts.isCallExpression(initializer) ||
        !ts.isIdentifier(initializer.expression) ||
        initializer.expression.text !== 'createStore'
      ) {
        continue;
      }
      const [shape] = initializer.arguments;
      if (shape === undefined || !ts.isObjectLiteralExpression(shape)) {
        throw tsxErrorAt(
          'TSX0323',
          'a store field needs a literal the compiler can type: string, ' +
            'number or boolean.',
          { sourceFile, node: initializer },
        );
      }
      stores.push({
        name: declaration.name.getText(),
        fields: shape.properties.map((property) => {
          if (
            !ts.isPropertyAssignment(property) ||
            !ts.isIdentifier(property.name)
          ) {
            throw tsxErrorAt(
              'TSX0323',
              'a store field needs a literal the compiler can type: ' +
                'string, number or boolean.',
              { sourceFile, node: property },
            );
          }
          return {
            name: property.name.text,
            dartType: storeFieldType(property.initializer, sourceFile),
            initialText: property.initializer.getText(),
          };
        }),
      });
    }
  }
  return stores;
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
    asyncBinding: null,
    storeUse: null,
    navigators: [],
    locals: [],
    handlers: [],
    helpers: [],
    effects: [],
    controllers: [],
    guards: [],
    returnJsx,
    sourceFile: context.sourceFile,
  };
  if (ts.isBlock(arrow.body)) {
    for (const statement of arrow.body.statements) {
      // Every statement is claimed by exactly one analyzer. A statement no
      // analyzer claims would compile to nothing — the developer's code
      // silently dropped — so it is an error, never a no-op.
      if (!analyzeBodyStatement(statement, { ...context, analysis })) {
        throw tsxErrorAt(
          'TSX0346',
          `\`${statement.getText(context.sourceFile).split('\n')[0]}\` is a ` +
            'statement the compiler does not translate to Dart.',
          { sourceFile: context.sourceFile, node: statement },
        );
      }
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

export interface AnalyzeOptions {
  /**
   * Whether the file must export a component. A file of helpers or models is
   * a legitimate part of a project — `src/lib/format.tsx` renders nothing —
   * so a caller importing from one says it expects no component.
   */
  requireComponent?: boolean;
}

export const analyzeSource = (
  source: string,
  filePath: string,
  options: AnalyzeOptions = {},
): SourceAnalysis => {
  const program = createProgramFor(source, filePath);
  const sourceFile = requireSourceFile(program, filePath);
  checkStrictMode(sourceFile);
  const checker = program.getTypeChecker();
  const { modules: hookModules, originals: importedOriginals } =
    importedHookModules(sourceFile);
  const stores = analyzeStores(sourceFile);
  // A store is as often declared in its own file as in this one; the file it
  // came from is resolved when the imports are, and refused there if it holds
  // no such store.
  const storeNames = new Set([
    ...stores.map((store) => store.name),
    ...relativeTypeImports(sourceFile).keys(),
  ]);

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
          storeNames,
          exported,
        },
      );
      if (component !== null) {
        components.push(component);
      }
    }
  }

  if (
    options.requireComponent !== false &&
    !components.some((component) => component.exported)
  ) {
    throw new TsxError(
      'TSX0103',
      'no exported component found: export a const arrow function that ' +
        'returns JSX.',
      { file: filePath, line: 1, column: 1 },
    );
  }
  const pluginImports = new Map(
    [...hookModules]
      .filter(([, module]) => module.startsWith(PLUGIN_MODULE_PREFIX))
      .map(([name, module]) => [
        name,
        {
          package: module.slice(PLUGIN_MODULE_PREFIX.length),
          exportedName: importedOriginals.get(name) ?? name,
        },
      ]),
  );
  const helpers = analyzeHelpers(sourceFile);
  // A file with no component is a file of declarations: everything it exports
  // is the reason it exists, so every exported shape becomes a model.
  const declarationsOnly = components.length === 0;
  // A helper's return type is a model too: `lookup().title` reads it, so the
  // shape has to exist in Dart the same as a prop's or a decoded body's does.
  const constants = analyzeConstants(sourceFile);
  const models = analyzeModels(
    sourceFile,
    new Set([
      ...propModelNames(components),
      // Data declares its own shapes: `const ALBUMS: Album[]` needs Album.
      ...constants.map((constant) => namedDartType(constant.dartType)),
      ...helpers.map((helper) => namedDartType(helper.returnDartType)),
      ...helpers.flatMap((helper) =>
        helper.params.map((param) => namedDartType(param.dartType)),
      ),
      ...(declarationsOnly ? exportedShapeNames(sourceFile) : []),
    ]),
  );
  const enums = analyzeEnums(sourceFile);
  const componentImports = new Map(
    [...hookModules].filter(([, module]) => module.startsWith('.')),
  );
  const router = analyzeRouter(
    sourceFile,
    new Set([
      ...components.map((component) => component.name),
      // A page imported from a sibling file is as routable as one declared
      // here; the import is resolved when the file is compiled.
      ...componentImports.keys(),
    ]),
  );
  return {
    components,
    constants,
    stores,
    router,
    models,
    helpers,
    enums,
    checker,
    sourceFile,
    pluginImports,
    componentImports,
  };
};

/**
 * What a callback is handed: `onChanged={(value: string) => …}` takes a
 * String, and the type has to be written because Dart declares it.
 */
const handlerParams = (
  arrow: ts.ArrowFunction,
  sourceFile: ts.SourceFile,
): { name: string; dartType: string }[] =>
  arrow.parameters.map((parameter) => {
    const dartType =
      parameter.type === undefined
        ? null
        : dartPropType(parameter.type, sourceFile);
    if (dartType === null || !ts.isIdentifier(parameter.name)) {
      throw tsxErrorAt(
        'TSX0347',
        'a callback parameter needs a type the compiler knows: ' +
          '`(value: string) => …`.',
        { sourceFile, node: parameter },
      );
    }
    return { name: parameter.name.text, dartType };
  });

/** The Dart type a literal value has on its own, with no annotation. */
const literalDartType = (initializer: ts.Expression): string | null => {
  if (ts.isStringLiteral(initializer)) {
    return 'String';
  }
  if (ts.isNumericLiteral(initializer)) {
    return 'num';
  }
  if (
    initializer.kind === ts.SyntaxKind.TrueKeyword ||
    initializer.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return 'bool';
  }
  return null;
};

/**
 * Data the module declares: an exported const with a literal for a value.
 *
 * A store, a router and a component are consts too, so this claims only what
 * they are not — a value with a Dart type and no function in it.
 */
const analyzeConstants = (sourceFile: ts.SourceFile): ConstantBinding[] => {
  const constants: ConstantBinding[] = [];
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
      const { initializer, type } = declaration;
      if (
        initializer === undefined ||
        ts.isArrowFunction(initializer) ||
        !ts.isIdentifier(declaration.name)
      ) {
        continue;
      }
      // A literal says what it is; anything else needs the annotation that
      // names its shape.
      const dartType =
        type === undefined
          ? literalDartType(initializer)
          : dartPropType(type, sourceFile);
      if (dartType === null) {
        continue;
      }
      constants.push({
        name: declaration.name.text,
        dartType,
        expression: initializer,
      });
    }
  }
  return constants;
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
