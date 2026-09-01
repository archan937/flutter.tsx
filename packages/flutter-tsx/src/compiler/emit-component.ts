import type { DartExpr } from './dart-ast';
import { MAX_WIDTH, printExpr } from './dart-print';
import { importsForComponents } from './imports';
import type {
  IrComponent,
  IrConstant,
  IrEnum,
  IrHelper,
  IrImport,
  IrMethod,
  IrModel,
  IrModelField,
  IrOverride,
  IrRouter,
  IrStore,
} from './ir';
import { irValueToDart, irWidgetToDart, isConstable } from './ir-to-dart';
import type { CompileContext } from './lower';
import { initStateLines, methodStatementLines } from './statements';

const RETURN_SITE = { indent: 4, used: 11, trailing: 1 };

const emitMethod = (method: IrMethod): string => {
  const params = method.params
    .map((param) => `${param.dartType} ${param.name}`)
    .join(', ');
  const signature = method.isAsync
    ? `Future<void> _${method.name}(${params}) async`
    : `void _${method.name}(${params})`;
  const lines = methodStatementLines(method.statements).map(
    (line) => `    ${line}`,
  );
  return `  ${signature} {\n${lines.join('\n')}\n  }`;
};

const emitSetupMethods = (component: IrComponent): string[] =>
  component.setupMethods.map((setup) => {
    const lines = setup.lines.map((line) => `    ${line}`);
    return `  Future<void> _${setup.name}() async {\n${lines.join('\n')}\n  }`;
  });

const emitDispose = (component: IrComponent): string[] => {
  if (
    component.disposeLines.length === 0 &&
    component.disposeStatements.length === 0
  ) {
    return [];
  }
  // An effect's cleanup releases what the effect set up, which may be using a
  // plugin controller — so it runs before the controller is disposed.
  const lines = [
    ...initStateLines(component.disposeStatements),
    ...component.disposeLines,
  ].map((line) => `    ${line}`);
  return [
    `  @override\n  void dispose() {\n${lines.join('\n')}\n    super.dispose();\n  }`,
  ];
};

const emitInitState = (component: IrComponent): string[] => {
  if (component.initStatements.length === 0) {
    return [];
  }
  const lines = initStateLines(component.initStatements).map(
    (line) => `    ${line}`,
  );
  return [
    `  @override\n  void initState() {\n    super.initState();\n${lines.join('\n')}\n  }`,
  ];
};

const buildMethod = (component: IrComponent): string => {
  const naming = { privateMembers: true };
  const body = printExpr(irWidgetToDart(component.body, naming), RETURN_SITE);
  const locals = component.buildLocals.map((local) => {
    const prefix = `final ${local.name} = `;
    const printed = printExpr(irValueToDart(local.value, naming), {
      indent: 4,
      used: 4 + prefix.length,
      trailing: 1,
    });
    return `    ${prefix}${printed};`;
  });
  const guards = component.guards.map((guard) => {
    const printed = printExpr(irValueToDart(guard.value, naming), {
      indent: 6,
      used: 13,
      trailing: 1,
    });
    return `    if (${guard.condition}) {\n      return ${printed};\n    }`;
  });
  return `  @override
  Widget build(BuildContext context) {
${[...locals, ...guards, `    return ${body};`].join('\n')}
  }`;
};

const constructorLine = (component: IrComponent): string => {
  const propParams = component.props.map((prop) =>
    prop.required ? `required this.${prop.name}` : `this.${prop.name}`,
  );
  const params = ['super.key', ...propParams];
  const single = `  const ${component.name}({${params.join(', ')}});`;
  if (single.length <= MAX_WIDTH) {
    return single;
  }
  // Too wide for one line: one parameter per line, trailing comma, which is
  // the shape the Dart formatter settles on.
  return [
    `  const ${component.name}({`,
    ...params.map((param) => `    ${param},`),
    '  });',
  ].join('\n');
};

const propFields = (component: IrComponent): string[] => {
  if (component.props.length === 0) {
    return [];
  }
  return [
    component.props
      .map((prop) => {
        const dartType = prop.required ? prop.dartType : `${prop.dartType}?`;
        return `  final ${dartType} ${prop.name};`;
      })
      .join('\n'),
  ];
};

const emitStatelessClass = (component: IrComponent): string => {
  const members = [
    constructorLine(component),
    ...propFields(component),
    ...component.helpers.map(emitComponentHelper),
    ...component.methods.map(emitMethod),
    buildMethod(component),
  ];
  return (
    `class ${component.name} extends StatelessWidget {\n` +
    `${members.join('\n\n')}\n}`
  );
};

const emitStatefulClass = (component: IrComponent): string => {
  const { name } = component;
  const fields = component.fields
    .map((field) => {
      const modifier =
        field.lateFinal === true
          ? 'late final '
          : field.mutable
            ? ''
            : 'final ';
      const initializer =
        field.initializer === null ? '' : ` = ${field.initializer}`;
      return `  ${modifier}${field.dartType} ${field.name}${initializer};`;
    })
    .join('\n');
  const stateMembers = [
    fields,
    ...emitInitState(component),
    ...emitSetupMethods(component),
    ...emitDispose(component),
    ...component.overrides.map(emitOverride),
    ...component.helpers.map(emitComponentHelper),
    ...component.methods.map(emitMethod),
    buildMethod(component),
  ];
  // Props are fields of the widget, which the State reads through `widget`.
  const widgetMembers = [
    constructorLine(component),
    ...propFields(component),
    `  @override\n  State<${name}> createState() => _${name}State();`,
  ];
  return (
    `class ${name} extends StatefulWidget {\n` +
    `${widgetMembers.join('\n\n')}\n` +
    `}\n\n` +
    `class _${name}State extends State<${name}>${mixinClause(component)} {\n` +
    `${stateMembers.join('\n\n')}\n}`
  );
};

/** `with TrayListener` — how a widget says it answers a plugin's events. */
const mixinClause = (component: IrComponent): string =>
  component.mixins.length === 0 ? '' : ` with ${component.mixins.join(', ')}`;

const emitOverride = (override: IrOverride): string => {
  const params = override.params
    .map((param) => `${param.dartType} ${param.name}`)
    .join(', ');
  const lines = methodStatementLines(override.statements).map(
    (line) => `    ${line}`,
  );
  return (
    `  @override\n  void ${override.name}(${params}) {\n` +
    `${lines.join('\n')}\n  }`
  );
};

const emitComponentClass = (component: IrComponent): string =>
  component.kind === 'stateful'
    ? emitStatefulClass(component)
    : emitStatelessClass(component);

// dart format keeps a constructor's params on one line while they fit, then
// splits one per line — the same rule as any other call.
const storeConstructorLines = (store: IrStore): string[] => {
  const params = store.fields.map((field) => `required this.${field.name}`);
  const inline = `  ${store.className}({${params.join(', ')}});`;
  if (inline.length <= 80) {
    return [inline];
  }
  return [
    `  ${store.className}({`,
    ...params.map((param) => `    ${param},`),
    '  });',
  ];
};

const storeUpdateMethod = (store: IrStore): string[] => {
  const params = store.fields.map(
    (field) => `${field.dartType}? ${field.name}`,
  );
  const signature = `  void update({${params.join(', ')}}) {`;
  const header =
    signature.length <= 80
      ? [signature]
      : [
          '  void update({',
          ...params.map((param) => `    ${param},`),
          '  }) {',
        ];
  return [
    ...header,
    ...store.fields.flatMap((field) => [
      `    if (${field.name} != null) {`,
      `      this.${field.name} = ${field.name};`,
      '    }',
    ]),
    '    notifyListeners();',
    '  }',
  ];
};

const emitStore = (store: IrStore): string => {
  const lines = [
    `class ${store.className} extends ChangeNotifier {`,
    ...storeConstructorLines(store),
    '',
    ...store.fields.map((field) => `  ${field.dartType} ${field.name};`),
    '',
    ...storeUpdateMethod(store),
    '}',
  ];
  const args = store.fields.map(
    (field) => `${field.name}: ${field.initializer}`,
  );
  const declaration = `final ${store.className} ${store.instanceName} = `;
  const inline = `${declaration}${store.className}(${args.join(', ')});`;
  const instance =
    inline.length <= 80
      ? [inline]
      : [
          `${declaration}${store.className}(`,
          ...args.map((argument) => `  ${argument},`),
          ');',
        ];
  return `${lines.join('\n')}\n\n${instance.join('\n')}`;
};

// A model renders as the Flutter cookbook's own JSON pattern: a const
// constructor plus a `fromJson` factory that casts each field out of the
// decoded map.
const modelFieldCast = (field: IrModelField): string => {
  const nullable = field.required ? '' : '?';
  const key = `json['${field.name}']`;
  const list = /^List<(.+)>$/.exec(field.dartType);
  if (list !== null) {
    return `${field.name}: (${key} as List<dynamic>).cast<${list[1] ?? ''}>(),`;
  }
  if (field.isModel) {
    return `${field.name}: ${field.dartType}.fromJson(${key} as Map<String, dynamic>),`;
  }
  return `${field.name}: ${key} as ${field.dartType}${nullable},`;
};

const modelConstructorLines = (model: IrModel): string[] => {
  const params = model.fields.map(
    (field) => `${field.required ? 'required ' : ''}this.${field.name}`,
  );
  const inline = `  const ${model.name}({${params.join(', ')}});`;
  if (inline.length <= 80) {
    return [inline];
  }
  return [
    `  const ${model.name}({`,
    ...params.map((param) => `    ${param},`),
    '  });',
  ];
};

// dart format lays out an arrow member in three steps, each tried in turn:
// all on one line; break after `=>` with the body on one line indented four;
// otherwise keep the call on the signature line and split its arguments.
const modelFactoryLines = (model: IrModel): string[] => {
  const casts = model.fields.map(modelFieldCast);
  const signature = `  factory ${model.name}.fromJson(Map<String, dynamic> json) =>`;
  const body = `${model.name}(${casts.join(' ').replace(/,$/, '')});`;

  const oneLine = `${signature} ${body}`;
  if (oneLine.length <= 80) {
    return [oneLine];
  }
  const brokenBody = `      ${body}`;
  if (brokenBody.length <= 80) {
    return [signature, brokenBody];
  }
  return [
    `${signature} ${model.name}(`,
    ...casts.map((cast) => `    ${cast}`),
    '  );',
  ];
};

const emitModel = (model: IrModel): string =>
  [
    `class ${model.name} {`,
    ...modelConstructorLines(model),
    '',
    ...modelFactoryLines(model),
    '',
    ...model.fields.map(
      (field) =>
        `  final ${field.dartType}${field.required ? '' : '?'} ${field.name};`,
    ),
    '}',
  ].join('\n');

export const GO_ROUTER_IMPORT = 'package:go_router/go_router.dart';

// dart format keeps each GoRoute on one line while it fits, and the routes
// list always splits because the router call does.
const emitRouter = (router: IrRouter): string => {
  const routes = router.routes.map((route) => {
    const inline =
      `    GoRoute(path: '${route.path}', ` +
      `builder: (context, state) => const ${route.component}()),`;
    if (inline.length <= 80) {
      return inline;
    }
    return [
      `    GoRoute(`,
      `      path: '${route.path}',`,
      `      builder: (context, state) => const ${route.component}(),`,
      '    ),',
    ].join('\n');
  });
  return [
    `final GoRouter ${router.name} = GoRouter(`,
    '  routes: [',
    ...routes,
    '  ],',
    ');',
  ].join('\n');
};

export interface DartFileParts {
  constants?: IrConstant[];
  stores?: IrStore[];
  router?: IrRouter | null;
  models?: IrModel[];
  helpers?: IrHelper[];
  enums?: IrEnum[];
  /**
   * Dart libraries a helper's body needs — `dart:convert` to decode, or
   * `dart:math` under the prefix its members are reached through.
   */
  dartImports?: IrImport[];
}

/**
 * `const List<Album> albums = [ … ];`
 *
 * `const` when every value in it is one — which is what a literal is — and
 * `final` when something in it is computed, exactly as Dart requires.
 */
const emitConstant = (constant: IrConstant): string => {
  const printed = irValueToDart(constant.value, { privateMembers: false });
  // `const List<Album> albums = [ … ]` says const once: the declaration
  // carries it, so the value inside drops its own.
  const isConst = isConstable(constant.value);
  const value: DartExpr =
    isConst && (printed.kind === 'list' || printed.kind === 'call')
      ? { ...printed, isConst: false }
      : printed;
  const head = `${isConst ? 'const' : 'final'} ${constant.dartType} ${constant.name} =`;
  const body = printExpr(value, {
    indent: 0,
    used: head.length + 1,
    trailing: 1,
  });
  return `${head} ${body};`;
};

/** A helper the component owns: a private method, indented into the class. */
const emitComponentHelper = (helper: IrHelper): string =>
  emitHelper({ ...helper, name: `_${helper.name}` })
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

/** A TypeScript enum is a namespace of constants, so that is what it emits. */
const emitEnum = (entity: IrEnum): string =>
  [
    `abstract final class ${entity.name} {`,
    ...entity.members.map(
      (member) =>
        `  static const ${entity.dartType} ${member.dartName} = ${member.value};`,
    ),
    '}',
  ].join('\n');

const HELPER_BODY_INDENT = 4;

/** `String shout(String value) => value.toUpperCase();` */
const emitHelper = (helper: IrHelper): string => {
  const required = helper.params.filter((param) => param.defaultValue === null);
  const optional = helper.params.filter((param) => param.defaultValue !== null);
  // Dart writes defaults as optional positionals, in one trailing group.
  const params = [
    ...required.map((param) => `${param.dartType} ${param.name}`),
    ...(optional.length === 0
      ? []
      : [
          `[${optional
            .map(
              (param) =>
                `${param.dartType} ${param.name} = ${param.defaultValue ?? ''}`,
            )
            .join(', ')}]`,
        ]),
  ].join(', ');
  const generics =
    helper.typeParams.length === 0 ? '' : `<${helper.typeParams.join(', ')}>`;
  const signature = `${helper.returnDartType} ${helper.name}${generics}(${params})`;
  if (helper.body.kind === 'block') {
    const lines = methodStatementLines(helper.body.statements, {
      privateMembers: false,
    }).map((line) => `  ${line}`);
    return `${signature} {\n${lines.join('\n')}\n}`;
  }
  const head = `${signature} =>`;
  const body = printExpr(
    irValueToDart(helper.body.value, { privateMembers: false }),
    {
      indent: HELPER_BODY_INDENT,
      used: head.length + 1,
      trailing: 1,
    },
  );
  const oneLine = `${head} ${body};`;
  return oneLine.length <= MAX_WIDTH && !body.includes('\n')
    ? oneLine
    : `${head}\n    ${body};`;
};

export const emitDartFile = (
  components: IrComponent[],
  context: CompileContext,
  parts: DartFileParts = {},
): string => {
  const {
    constants = [],
    stores = [],
    router = null,
    models = [],
    helpers = [],
    enums = [],
    dartImports = [],
  } = parts;
  const classes = [
    ...enums.map(emitEnum),
    ...helpers.map(emitHelper),
    ...models.map(emitModel),
    // Data comes after the models it is written with, so the file reads in
    // the order it is understood.
    ...constants.map(emitConstant),
    ...stores.map(emitStore),
    ...components.map(emitComponentClass),
    ...(router === null ? [] : [emitRouter(router)]),
  ];
  const pluginImports = components
    .flatMap((component) => component.pluginImports)
    .map(
      ({ uri, prefix }) =>
        `import '${uri}'${prefix === null ? '' : ` as ${prefix}`};`,
    );
  const directives = [
    ...new Set([
      // A store extends ChangeNotifier and a component extends
      // StatelessWidget; a file of only helpers or models extends nothing.
      ...importsForComponents(components, context, {
        // A store extends ChangeNotifier and a component extends
        // StatelessWidget. A file holding only a route table names neither:
        // GoRouter comes from go_router and each page from its own file.
        needsFlutter: components.length > 0 || stores.length > 0,
        alsoNamed: router?.routes.map((route) => route.component) ?? [],
      }),
      ...pluginImports,
      ...dartImports.map(({ uri, prefix }) =>
        prefix === null ? `import '${uri}';` : `import '${uri}' as ${prefix};`,
      ),
      // GoRouter and GoRoute themselves need the import, even in a file whose
      // components never navigate.
      ...(router === null ? [] : [`import '${GO_ROUTER_IMPORT}';`]),
    ]),
  ].sort();
  // Dart convention (and what dart format leaves alone): dart: first, then
  // package:, then this project's own files, each group separated by a blank
  // line.
  const group = (prefix: string): string[] =>
    directives.filter((line) => line.startsWith(prefix));
  const relativeGroup = directives.filter(
    (line) =>
      !line.startsWith("import 'dart:") && !line.startsWith("import 'package:"),
  );
  const imports = [
    group("import 'dart:"),
    group("import 'package:"),
    relativeGroup,
  ]
    .filter((lines) => lines.length > 0)
    .reduce<string[]>(
      (all, lines) => (all.length === 0 ? lines : [...all, '', ...lines]),
      [],
    );
  // A file of plain models imports nothing, and `dart format` will not keep
  // the blank lines an empty import block would leave at the top.
  const body = classes.join('\n\n');
  return imports.length === 0
    ? `${body}\n`
    : `${imports.join('\n')}\n\n${body}\n`;
};
