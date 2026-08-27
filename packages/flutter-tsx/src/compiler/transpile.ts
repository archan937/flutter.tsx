import { loadApiSnapshot } from '../api/load';
import { deriveSlots } from '../derive/slots';
import { loadPluginApi } from '../plugins/api';
import { deriveHooks } from '../plugins/hooks';
import { PLUGIN_OVERRIDES } from '../plugins/overrides';
import { analyzeSource, type ComponentAnalysis } from './analyze';
import { tsxErrorAt } from './diagnostics';
import { emitDartFile } from './emit-component';
import {
  buildCompileContext,
  buildUserWidgets,
  type CompileContext,
  lowerComponent,
  type PluginHookInfo,
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

const loadPluginHooks = async (
  components: ComponentAnalysis[],
): Promise<Map<string, PluginHookInfo>> => {
  const packages = [
    ...new Set(
      components.flatMap((component) =>
        component.plugins.map((binding) => binding.package),
      ),
    ),
  ];
  const hooks = new Map<string, PluginHookInfo>();
  for (const packageName of packages) {
    const api = await loadPluginApi(packageName);
    for (const hook of deriveHooks(api, PLUGIN_OVERRIDES[packageName])) {
      const entity = api.classes.find(
        (candidate) => candidate.name === hook.className,
      );
      hooks.set(hook.hookName, {
        hook,
        methods: new Set(entity?.methods.map((method) => method.name) ?? []),
      });
    }
  }
  return hooks;
};

export const transpileComponent = async (
  input: TranspileInput,
): Promise<string> => {
  const context = await compileContext();
  const analysis = analyzeSource(input.source, input.filePath);
  const fileContext = {
    ...context,
    userWidgets: buildUserWidgets(analysis.components),
    pluginHooks: await loadPluginHooks(analysis.components),
  };
  const components = analysis.components.map((component) => {
    requireSupported(component);
    return lowerComponent(component, fileContext);
  });
  return emitDartFile(components, fileContext);
};
