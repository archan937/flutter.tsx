import { printExpr } from './dart-print';
import { importsForComponents } from './imports';
import type { IrComponent, IrMethod } from './ir';
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
      const modifier = field.mutable ? '' : 'final ';
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

export const emitDartFile = (
  components: IrComponent[],
  context: CompileContext,
): string => {
  const classes = components.map(emitComponentClass);
  const pluginImports = components
    .flatMap((component) => component.pluginImports)
    .map((dartImport) => `import '${dartImport}';`);
  const imports = [
    ...new Set([
      ...importsForComponents(components, context),
      ...pluginImports,
    ]),
  ].sort((first, second) => first.localeCompare(second));
  return `${imports.join('\n')}\n\n${classes.join('\n\n')}\n`;
};
