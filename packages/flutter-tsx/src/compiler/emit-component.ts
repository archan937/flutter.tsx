import { MAX_WIDTH, printExpr } from './dart-print';
import { importsForComponents } from './imports';
import type {
  IrComponent,
  IrEnum,
  IrHelper,
  IrMethod,
  IrModel,
  IrModelField,
  IrRouter,
  IrStore,
} from './ir';
import { irValueToDart, irWidgetToDart } from './ir-to-dart';
import type { CompileContext } from './lower';
import { initStateLines, methodStatementLines } from './statements';

const RETURN_SITE = { indent: 4, used: 11, trailing: 1 };

const emitMethod = (method: IrMethod): string => {
  const signature = method.isAsync
    ? `Future<void> _${method.name}() async`
    : `void _${method.name}()`;
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
  if (component.disposeLines.length === 0) {
    return [];
  }
  const lines = component.disposeLines.map((line) => `    ${line}`);
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
  return `  @override
  Widget build(BuildContext context) {
${[...locals, `    return ${body};`].join('\n')}
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
    `class _${name}State extends State<${name}> {\n` +
    `${stateMembers.join('\n\n')}\n}`
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
  stores?: IrStore[];
  router?: IrRouter | null;
  models?: IrModel[];
  helpers?: IrHelper[];
  enums?: IrEnum[];
}

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
  const params = helper.params
    .map((param) => `${param.dartType} ${param.name}`)
    .join(', ');
  const head = `${helper.returnDartType} ${helper.name}(${params}) =>`;
  const body = printExpr(
    irValueToDart(helper.value, { privateMembers: false }),
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
    stores = [],
    router = null,
    models = [],
    helpers = [],
    enums = [],
  } = parts;
  const classes = [
    ...enums.map(emitEnum),
    ...helpers.map(emitHelper),
    ...models.map(emitModel),
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
      ...importsForComponents(components, context),
      ...pluginImports,
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
  return `${imports.join('\n')}\n\n${classes.join('\n\n')}\n`;
};
