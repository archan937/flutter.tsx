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

const emitStatelessClass = (component: IrComponent): string => {
  const members = [
    `  const ${component.name}({super.key});`,
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
    .map((field) => `  ${field.dartType} ${field.name} = ${field.initializer};`)
    .join('\n');
  const stateMembers = [
    fields,
    ...emitInitState(component),
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
  const imports = importsForComponents(components, context);
  return `${imports.join('\n')}\n\n${classes.join('\n\n')}\n`;
};
