import ts from 'typescript';

import { loadApiSnapshot } from '../api/load';
import type { TypeNode } from '../api/model';
import { deriveSlots } from '../derive/slots';
import { loadPluginApi, type PluginApi } from '../plugins/api';
import { deriveHooks } from '../plugins/hooks';
import { PACKAGE_OVERRIDES, PLUGIN_OVERRIDES } from '../plugins/overrides';
import { analyzeSource, type SourceAnalysis } from './analyze';
import { dartFileFor } from './dart-names';
import { TsxError } from './diagnostics';
import { emitDartFile } from './emit-component';
import type { IrEnum } from './ir';
import {
  buildCompileContext,
  buildUserWidgets,
  type CompileContext,
  lowerComponent,
  lowerHelper,
  lowerModel,
  lowerRouter,
  lowerStore,
  type PluginFunctionInfo,
  type PluginHookInfo,
  type WidgetInfo,
} from './lower';
import type { HelperSignature } from './translate';

export interface TranspileInput {
  source: string;
  filePath: string;
  /**
   * Directories holding plugin APIs extracted for this project by
   * `fsx install`, searched before the reference set bundled with this
   * package.
   */
  pluginApiDirs?: readonly string[];
}

let contextPromise: Promise<CompileContext> | undefined;

const compileContext = (): Promise<CompileContext> => {
  contextPromise ??= loadApiSnapshot().then((snapshot) =>
    buildCompileContext(snapshot, deriveSlots(snapshot)),
  );
  return contextPromise;
};

interface LoadedPlugins {
  pluginHooks: Map<string, PluginHookInfo>;
  pluginFunctions: Map<string, PluginFunctionInfo>;
  pluginEnums: Map<string, Set<string>>;
  pluginClassFields: Map<string, Map<string, TypeNode>>;
  prefixedTypes: Map<string, string>;
}

const loadPlugins = async (
  analysis: SourceAnalysis,
  pluginApiDirs: readonly string[],
): Promise<LoadedPlugins> => {
  const packages = [
    ...new Set([
      ...analysis.components.flatMap((component) =>
        component.plugins.map((binding) => binding.package),
      ),
      ...[...analysis.pluginImports.values()].map(
        (imported) => imported.package,
      ),
    ]),
  ];
  const pluginHooks = new Map<string, PluginHookInfo>();
  const pluginEnums = new Map<string, Set<string>>();
  const pluginClassFields = new Map<string, Map<string, TypeNode>>();
  const prefixedTypes = new Map<string, string>();
  const apis = new Map<string, PluginApi>();
  for (const packageName of packages) {
    const api = await loadPluginApi(packageName, pluginApiDirs);
    apis.set(packageName, api);
    for (const entity of api.enums) {
      pluginEnums.set(entity.name, new Set(entity.values));
    }
    const prefix = PACKAGE_OVERRIDES[packageName]?.importPrefix;
    for (const entity of api.classes) {
      pluginClassFields.set(
        entity.name,
        new Map(entity.fields.map((field) => [field.name, field.type])),
      );
      if (prefix !== undefined) {
        prefixedTypes.set(entity.name, `${prefix}.${entity.name}`);
      }
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
  for (const [localName, imported] of analysis.pluginImports) {
    const api = apis.get(imported.package);
    // Resolved by the exported name, so `import { get as httpGet }` works.
    const fn = api?.functions.find(
      (candidate) => candidate.name === imported.exportedName,
    );
    if (api !== undefined && fn !== undefined) {
      pluginFunctions.set(localName, {
        fn,
        dartImport: `package:${api.package}/${api.package}.dart`,
        importPrefix: PACKAGE_OVERRIDES[api.package]?.importPrefix ?? null,
      });
    }
  }
  return {
    pluginHooks,
    pluginFunctions,
    pluginEnums,
    pluginClassFields,
    prefixedTypes,
  };
};

/** Component names this file uses as JSX elements. */
const usedJsxNames = (sourceFile: ts.SourceFile): Set<string> => {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const { tagName } = node;
      if (ts.isIdentifier(tagName)) {
        names.add(tagName.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
};

const parentDir = (filePath: string): string =>
  filePath.slice(0, filePath.lastIndexOf('/'));

/** Resolves `./Card` against the importing file, without a path library. */
const resolveSibling = (fromDir: string, specifier: string): string => {
  const segments = [...fromDir.split('/'), ...specifier.split('/')];
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }
  return `/${resolved.join('/')}`;
};

export interface ImportedComponents {
  widgets: Map<string, WidgetInfo>;
  /** local name -> the Dart file to import, relative to this component's. */
  componentImports: Map<string, string>;
}

/**
 * Loads the components this file imports from sibling files, so a
 * `<UserCard />` declared next door compiles to that component — and to a
 * Dart import of its file — rather than silently binding to a Flutter widget
 * that happens to share its name.
 */
const loadImportedComponents = async (
  analysis: SourceAnalysis,
  filePath: string,
): Promise<ImportedComponents> => {
  const widgets = new Map<string, WidgetInfo>();
  const componentImports = new Map<string, string>();
  const used = usedJsxNames(analysis.sourceFile);
  const fromDir = parentDir(filePath);

  for (const [name, specifier] of analysis.componentImports) {
    if (!used.has(name)) continue;

    const resolved = `${resolveSibling(fromDir, specifier)}.tsx`;
    const file = Bun.file(resolved);
    if (!(await file.exists())) {
      throw new TsxError(
        'TSX0336',
        `<${name} /> is imported from '${specifier}', but ${resolved} does ` +
          'not exist.',
        { file: filePath, line: 1, column: 1 },
      );
    }

    const imported = analyzeSource(await file.text(), resolved);
    const component = imported.components.find(
      (candidate) => candidate.name === name,
    );
    if (component === undefined) {
      throw new TsxError(
        'TSX0336',
        `${resolved} exports no component named ${name}.`,
        { file: filePath, line: 1, column: 1 },
      );
    }

    const info = buildUserWidgets([component]).get(name);
    if (info !== undefined) {
      widgets.set(name, info);
    }
    componentImports.set(
      name,
      dartFileFor(`${specifier}.tsx`).replace(/^\.\//, ''),
    );
  }

  return { widgets, componentImports };
};

export const transpileComponent = async (
  input: TranspileInput,
): Promise<string> => {
  const context = await compileContext();
  const analysis = analyzeSource(input.source, input.filePath);
  const imported = await loadImportedComponents(analysis, input.filePath);
  const fileContext = {
    ...context,
    componentImports: imported.componentImports,
    userWidgets: new Map([
      ...imported.widgets,
      ...buildUserWidgets(analysis.components),
    ]),
    stores: new Map(
      analysis.stores.map((store) => [store.name, lowerStore(store)]),
    ),
    models: new Map(
      analysis.models.map((model) => [
        model.name,
        lowerModel(model, new Set(analysis.models.map((each) => each.name))),
      ]),
    ),
    enumMembers: new Map(
      analysis.enums.map((entity): [string, Map<string, string>] => [
        entity.name,
        new Map(entity.members.map((member) => [member.name, member.dartName])),
      ]),
    ),
    helperReturns: new Map(
      analysis.helpers.map((helper): [string, HelperSignature] => [
        helper.name,
        {
          typeParams: helper.typeParams,
          params: helper.params,
          returnDartType: helper.returnDartType,
        },
      ]),
    ),
    ...(await loadPlugins(analysis, input.pluginApiDirs ?? [])),
  };
  const components = analysis.components.map((component) =>
    lowerComponent(component, fileContext),
  );
  const helpers = analysis.helpers.map(lowerHelper);
  const enums = analysis.enums.map((entity): IrEnum => ({
    name: entity.name,
    dartType: entity.dartType,
    members: entity.members.map((member) => ({
      dartName: member.dartName,
      value: member.value,
    })),
  }));
  return emitDartFile(components, fileContext, {
    helpers,
    enums,
    stores: [...fileContext.stores.values()],
    router: analysis.router === null ? null : lowerRouter(analysis.router),
    models: [...fileContext.models.values()],
  });
};
