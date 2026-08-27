import { loadApiSnapshot } from '../api/load';
import { deriveSlots } from '../derive/slots';
import { loadPluginApi, type PluginApi } from '../plugins/api';
import { deriveHooks } from '../plugins/hooks';
import { PLUGIN_OVERRIDES } from '../plugins/overrides';
import {
  analyzeSource,
  type ComponentAnalysis,
  type SourceAnalysis,
} from './analyze';
import { tsxErrorAt } from './diagnostics';
import { emitDartFile } from './emit-component';
import {
  buildCompileContext,
  buildUserWidgets,
  type CompileContext,
  lowerComponent,
  lowerStore,
  type PluginFunctionInfo,
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

interface LoadedPlugins {
  pluginHooks: Map<string, PluginHookInfo>;
  pluginFunctions: Map<string, PluginFunctionInfo>;
  pluginEnums: Map<string, Set<string>>;
}

const loadPlugins = async (
  analysis: SourceAnalysis,
): Promise<LoadedPlugins> => {
  const packages = [
    ...new Set([
      ...analysis.components.flatMap((component) =>
        component.plugins.map((binding) => binding.package),
      ),
      ...analysis.pluginImports.values(),
    ]),
  ];
  const pluginHooks = new Map<string, PluginHookInfo>();
  const pluginEnums = new Map<string, Set<string>>();
  const apis = new Map<string, PluginApi>();
  for (const packageName of packages) {
    const api = await loadPluginApi(packageName);
    apis.set(packageName, api);
    for (const entity of api.enums) {
      pluginEnums.set(entity.name, new Set(entity.values));
    }
    for (const hook of deriveHooks(api, PLUGIN_OVERRIDES[packageName])) {
      const entity = api.classes.find(
        (candidate) => candidate.name === hook.className,
      );
      pluginHooks.set(hook.hookName, {
        hook,
        methods: new Map(
          entity?.methods.map((method) => [method.name, method]) ?? [],
        ),
        fields: new Map(
          entity?.fields.map((field) => [field.name, field.type]) ?? [],
        ),
      });
    }
  }
  const pluginFunctions = new Map<string, PluginFunctionInfo>();
  for (const [localName, packageName] of analysis.pluginImports) {
    const api = apis.get(packageName);
    const fn = api?.functions.find((candidate) => candidate.name === localName);
    if (api !== undefined && fn !== undefined) {
      pluginFunctions.set(localName, {
        fn,
        dartImport: `package:${api.package}/${api.package}.dart`,
      });
    }
  }
  return { pluginHooks, pluginFunctions, pluginEnums };
};

export const transpileComponent = async (
  input: TranspileInput,
): Promise<string> => {
  const context = await compileContext();
  const analysis = analyzeSource(input.source, input.filePath);
  const fileContext = {
    ...context,
    userWidgets: buildUserWidgets(analysis.components),
    stores: new Map(
      analysis.stores.map((store) => [store.name, lowerStore(store)]),
    ),
    ...(await loadPlugins(analysis)),
  };
  const components = analysis.components.map((component) => {
    requireSupported(component);
    return lowerComponent(component, fileContext);
  });
  return emitDartFile(components, fileContext, [
    ...fileContext.stores.values(),
  ]);
};
