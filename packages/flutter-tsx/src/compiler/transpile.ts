import { loadApiSnapshot } from '../api/load';
import { deriveSlots } from '../derive/slots';
import { analyzeSource, type ComponentAnalysis } from './analyze';
import { tsxErrorAt } from './diagnostics';
import { emitDartFile } from './emit-component';
import {
  buildCompileContext,
  buildUserWidgets,
  type CompileContext,
  lowerComponent,
} from './lower';

export interface TranspileInput {
  source: string;
  filePath: string;
}

let contextPromise: Promise<CompileContext> | undefined;

const compileContext = (): Promise<CompileContext> => {
  contextPromise ??= loadApiSnapshot().then((snapshot) =>
    buildCompileContext(snapshot, deriveSlots(snapshot)),
  );
  return contextPromise;
};

const requireSupported = (component: ComponentAnalysis): void => {
  if (component.plugins.length > 0) {
    throw tsxErrorAt(
      'TSX0304',
      `<${component.name}> uses plugin hooks — plugin compilation lands at ` +
        'roadmap step 22.',
      { sourceFile: component.sourceFile, node: component.nameNode },
    );
  }
  if (
    component.props.length > 0 &&
    (component.states.length > 0 || component.effects.length > 0)
  ) {
    throw tsxErrorAt(
      'TSX0310',
      `<${component.name}> combines props and state — stateful components ` +
        'with props land at a later roadmap step.',
      { sourceFile: component.sourceFile, node: component.nameNode },
    );
  }
};

export const transpileComponent = async (
  input: TranspileInput,
): Promise<string> => {
  const context = await compileContext();
  const analysis = analyzeSource(input.source, input.filePath);
  const fileContext = {
    ...context,
    userWidgets: buildUserWidgets(analysis.components),
  };
  const components = analysis.components.map((component) => {
    requireSupported(component);
    return lowerComponent(component, fileContext);
  });
  return emitDartFile(components, fileContext);
};
