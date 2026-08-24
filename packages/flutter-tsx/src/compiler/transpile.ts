import { loadApiSnapshot } from '../api/load';
import { deriveSlots } from '../derive/slots';
import { tsxErrorAt } from './diagnostics';
import { emitDartFile } from './emit-component';
import { analyzeSource, type ComponentAnalysis } from './front-end';
import {
  buildCompileContext,
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

const requirePlainStateless = (component: ComponentAnalysis): void => {
  const isPlainStateless =
    component.states.length === 0 &&
    component.plugins.length === 0 &&
    component.effects.length === 0 &&
    component.handlers.length === 0;
  if (!isPlainStateless) {
    throw tsxErrorAt(
      'TSX0301',
      `<${component.name}> uses state, plugins, effects, or handlers — only ` +
        'plain stateless components compile yet (stateful support lands at ' +
        'roadmap step 17).',
      { sourceFile: component.sourceFile, node: component.nameNode },
    );
  }
};

export const transpileComponent = async (
  input: TranspileInput,
): Promise<string> => {
  const context = await compileContext();
  const analysis = analyzeSource(input.source, input.filePath);
  const components = analysis.components.map((component) => {
    requirePlainStateless(component);
    return lowerComponent(component, context);
  });
  return emitDartFile(components, context);
};
