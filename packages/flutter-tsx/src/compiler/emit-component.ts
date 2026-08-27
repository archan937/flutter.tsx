import { printExpr } from './dart-print';
import { importsForComponents } from './imports';
import type { IrComponent, IrMethod, IrRouter, IrStore } from './ir';
import { irWidgetToDart } from './ir-to-dart';
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
  const body = printExpr(
    irWidgetToDart(component.body, { privateMembers: true }),
    RETURN_SITE,
  );
  return `  @override
  Widget build(BuildContext context) {
    return ${body};
  }`;
};

const constructorLine = (component: IrComponent): string => {
  const propParams = component.props.map((prop) =>
    prop.required ? `required this.${prop.name}` : `this.${prop.name}`,
  );
  const params = ['super.key', ...propParams].join(', ');
  return `  const ${component.name}({${params}});`;
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
    ...component.methods.map(emitMethod),
    buildMethod(component),
  ];
  return (
    `class ${name} extends StatefulWidget {\n` +
    `  const ${name}({super.key});\n\n` +
    `  @override\n` +
    `  State<${name}> createState() => _${name}State();\n` +
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
}

export const emitDartFile = (
  components: IrComponent[],
  context: CompileContext,
  parts: DartFileParts = {},
): string => {
  const { stores = [], router = null } = parts;
  const classes = [
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
  const imports = [
    ...new Set([
      ...importsForComponents(components, context),
      ...pluginImports,
      // GoRouter and GoRoute themselves need the import, even in a file whose
      // components never navigate.
      ...(router === null ? [] : [`import '${GO_ROUTER_IMPORT}';`]),
    ]),
  ].sort();
  return `${imports.join('\n')}\n\n${classes.join('\n\n')}\n`;
};
