import ts from 'typescript';

import { loadApiSnapshot } from '../api/load';
import type { ParamModel, TypeNode } from '../api/model';
import { deriveSlots } from '../derive/slots';
import { jsxPropName } from '../generate/renames';
import {
  loadPluginApi,
  type PluginApi,
  type PluginMethod,
} from '../plugins/api';
import { deriveHooks } from '../plugins/hooks';
import { PACKAGE_OVERRIDES, PLUGIN_OVERRIDES } from '../plugins/overrides';
import {
  analyzeSource,
  type ModelBinding,
  relativeTypeImports,
  type SourceAnalysis,
  type StoreBinding,
} from './analyze';
import { dartFileFor } from './dart-names';
import { TsxError } from './diagnostics';
import { emitDartFile } from './emit-component';
import type { IrEnum } from './ir';
import {
  buildCompileContext,
  buildUserWidgets,
  type CompileContext,
  lowerComponent,
  lowerConstant,
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
  /**
   * Plugin classes an object literal can construct: `{ enableJavaScript:
   * true }` where a WebViewConfiguration is expected. A value the plugin
   * hands you needs no constructor; one you pass to it does.
   */
  pluginConstructibles: Map<string, ParamModel[]>;
  /**
   * Every plugin class with a constructor, and the parameters it takes:
   * `new MediaType('text', 'plain')` calls one directly.
   */
  pluginConstructors: Map<string, ParamModel[]>;
  /**
   * The static methods each plugin class declares: named constructors and
   * factories — `MultipartFile.fromBytes(…)`, `SharedPreferencesWithCache
   * .create(…)` — which are how some values are made at all.
   */
  pluginStatics: Map<string, Map<string, PluginMethod>>;
  /** Widgets a plugin ships, rendered in JSX like any other. */
  pluginWidgets: Map<string, WidgetInfo>;
  /** The Dart file each of those widgets is imported from. */
  pluginWidgetImports: Map<string, string>;
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
  const pluginConstructibles = new Map<string, ParamModel[]>();
  const pluginConstructors = new Map<string, ParamModel[]>();
  const pluginStatics = new Map<string, Map<string, PluginMethod>>();
  const pluginWidgets = new Map<string, WidgetInfo>();
  const pluginWidgetImports = new Map<string, string>();
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
      const statics = entity.methods.filter((method) => method.isStatic);
      if (statics.length > 0) {
        pluginStatics.set(
          entity.name,
          new Map(statics.map((method) => [method.name, method])),
        );
      }
      // The same rule the typings use, so what compiles is what the editor
      // offered: an object literal builds a bag of named parameters.
      const constructor = entity.constructors.find(
        (candidate) => candidate.name === '',
      );
      if (constructor !== undefined) {
        pluginConstructors.set(entity.name, constructor.params);
      }
      if (
        constructor !== undefined &&
        constructor.params.length > 0 &&
        constructor.params.every((param) => param.named)
      ) {
        pluginConstructibles.set(entity.name, constructor.params);
      }
      // `<CameraPreview controller={cam} />` — a widget a package ships is
      // rendered, not called, and its constructor is its props.
      const widget = pluginWidget(entity);
      if (widget !== null) {
        pluginWidgets.set(entity.name, widget);
        pluginWidgetImports.set(
          entity.name,
          `package:${api.package}/${api.package}.dart`,
        );
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
    pluginConstructibles,
    pluginConstructors,
    pluginStatics,
    pluginWidgets,
    pluginWidgetImports,
  };
};

/** A plugin class that is a Widget, as the JSX layer understands widgets. */
const pluginWidget = (
  entity: PluginApi['classes'][number],
): WidgetInfo | null => {
  const constructor = entity.constructors.find(
    (candidate) => candidate.name === '',
  );
  if (!entity.supertypes.includes('Widget') || constructor === undefined) {
    return null;
  }
  const takenNames = new Set(constructor.params.map((param) => param.name));
  return {
    name: entity.name,
    library: '',
    constConstructor: constructor.isConst && !constructor.paramMemberAsserts,
    requiredOneOf: constructor.requiredOneOf,
    paramsByJsxName: new Map(
      constructor.params.map((param) => [
        jsxPropName(param.name, takenNames),
        param,
      ]),
    ),
    slots: { children: null, slots: [] },
  };
};

/** Component names this file uses as JSX elements. */
/** Names called as functions, which is how an imported helper is used. */
const calledNames = (sourceFile: ts.SourceFile): Set<string> => {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      names.add(node.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
};

/** Every name the file mentions, so an imported value is never dropped. */
const referencedNames = (sourceFile: ts.SourceFile): Set<string> => {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      names.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      visit(statement);
    }
  }
  return names;
};

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

/**
 * Resolves `./Card` against the importing file, without a path library. The
 * result keeps the form the importing path had: making a relative one
 * absolute would look for the file at the root of the disk.
 */
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
  const joined = resolved.join('/');
  return fromDir.startsWith('/') ? `/${joined}` : joined;
};

export interface ImportedComponents {
  widgets: Map<string, WidgetInfo>;
  /** local name -> the Dart file to import, relative to this component's. */
  componentImports: Map<string, string>;
  /** Signatures of helpers imported from a sibling file. */
  helperReturns: Map<string, HelperSignature>;
  /** Models declared in a sibling file, which this file reads but never emits. */
  models: Map<string, ModelBinding>;
  /** Stores declared in a sibling file, read the same way. */
  stores: Map<string, StoreBinding>;
  /** Data declared in a sibling file: name -> its Dart type. */
  constants: Map<string, string>;
  /** Dart files those helpers live in, which the output has to import. */
  dartImports: string[];
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
  const helperReturns = new Map<string, HelperSignature>();
  const models = new Map<string, ModelBinding>();
  const stores = new Map<string, StoreBinding>();
  const constants = new Map<string, string>();
  const dartImports: string[] = [];
  // A route target is a component the file names without rendering it here,
  // and it needs its class and its import exactly as a rendered one does.
  const used = new Set([
    ...usedJsxNames(analysis.sourceFile),
    ...(analysis.router?.routes.map((route) => route.component) ?? []),
  ]);
  const called = calledNames(analysis.sourceFile);
  const referenced = referencedNames(analysis.sourceFile);
  const fromDir = parentDir(filePath);

  for (const [name, specifier] of analysis.componentImports) {
    if (!used.has(name)) {
      // A helper imported from a sibling file is called, not rendered. It
      // needs its file imported too, or the Dart names a function that is
      // not there.
      if (called.has(name)) {
        const helper = await importedHelper(
          { name, specifier },
          { dir: fromDir, filePath },
        );
        helperReturns.set(name, helper.signature);
        dartImports.push(helper.dartFile);
        continue;
      }
      // Data imported from a sibling file — `import { ALBUMS } from './data'`.
      // It is read, not rendered or called, and its file has to be imported
      // or the Dart names something that is not there.
      if (referenced.has(name)) {
        const constant = await importedConstant(
          { name, specifier },
          { dir: fromDir, filePath },
        );
        if (constant !== null) {
          constants.set(name, constant.dartType);
          dartImports.push(constant.dartFile);
          // The shape the data holds is read here — `album.title` in a
          // callback — so its fields have to be known. The class itself is
          // emitted by the file that declares it and named only there, so no
          // import of it is added.
          for (const [modelName, model] of constant.models) {
            if (!models.has(modelName)) {
              models.set(modelName, model);
            }
          }
        }
      }
      continue;
    }

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

  // A type imported from a sibling file: its Dart class is emitted there, so
  // this file reads the shape and imports the file rather than declaring it
  // twice.
  for (const [name, specifier] of relativeTypeImports(analysis.sourceFile)) {
    if (used.has(name) || called.has(name)) continue;
    const resolved = `${resolveSibling(fromDir, specifier)}.tsx`;
    const file = Bun.file(resolved);
    if (!(await file.exists())) continue;
    const declared = analyzeSource(await file.text(), resolved, {
      requireComponent: false,
    });

    // A model's Dart class and a store's instance are both emitted by the
    // file that declares them; this one reads the shape and imports the file.
    const model = declared.models.find((candidate) => candidate.name === name);
    const store = declared.stores.find((candidate) => candidate.name === name);
    if (model === undefined && store === undefined) continue;
    if (model !== undefined) {
      for (const each of declared.models) {
        models.set(each.name, each);
      }
    }
    if (store !== undefined) {
      stores.set(store.name, store);
    }
    dartImports.push(dartFileFor(`${specifier}.tsx`).replace(/^\.\//, ''));
  }

  return {
    widgets,
    componentImports,
    helperReturns,
    models,
    stores,
    constants,
    dartImports,
  };
};

/** One helper from a sibling file, with the signature its declaration gives. */
/**
 * Data a sibling file exports, if that is what the imported name is.
 *
 * Null when the file has no such constant: the name may be a type, which is
 * erased, and a type import is not a mistake.
 */
const importedConstant = async (
  binding: { name: string; specifier: string },
  from: { dir: string; filePath: string },
): Promise<{
  dartType: string;
  dartFile: string;
  models: Map<string, ModelBinding>;
} | null> => {
  const { name, specifier } = binding;
  const resolved = `${resolveSibling(from.dir, specifier)}.tsx`;
  const file = Bun.file(resolved);
  if (!(await file.exists())) {
    return null;
  }
  const imported = analyzeSource(await file.text(), resolved, {
    requireComponent: false,
  });
  const constant = imported.constants.find(
    (candidate) => candidate.name === name,
  );
  if (constant === undefined) {
    return null;
  }
  return {
    dartType: constant.dartType,
    dartFile: dartFileFor(`${specifier}.tsx`).replace(/^\.\//, ''),
    models: await modelsVisibleTo(imported, resolved),
  };
};

/**
 * The models a file can name: the ones it declares, and the ones it imports
 * as types.
 *
 * A data file declares its shapes in a model file next door, so reading a
 * field off that data means following one hop from the data to the shape.
 */
const modelsVisibleTo = async (
  analysis: SourceAnalysis,
  filePath: string,
): Promise<Map<string, ModelBinding>> => {
  const models = new Map(
    analysis.models.map((model): [string, ModelBinding] => [model.name, model]),
  );
  const dir = parentDir(filePath);
  for (const [, specifier] of relativeTypeImports(analysis.sourceFile)) {
    const resolved = `${resolveSibling(dir, specifier)}.tsx`;
    const file = Bun.file(resolved);
    if (!(await file.exists())) {
      continue;
    }
    const declared = analyzeSource(await file.text(), resolved, {
      requireComponent: false,
    });
    for (const model of declared.models) {
      if (!models.has(model.name)) {
        models.set(model.name, model);
      }
    }
  }
  return models;
};

const importedHelper = async (
  binding: { name: string; specifier: string },
  from: { dir: string; filePath: string },
): Promise<{ signature: HelperSignature; dartFile: string }> => {
  const { name, specifier } = binding;
  const { dir: fromDir, filePath } = from;
  const resolved = `${resolveSibling(fromDir, specifier)}.tsx`;
  const file = Bun.file(resolved);
  if (!(await file.exists())) {
    throw new TsxError(
      'TSX0336',
      `\`${name}\` is imported from '${specifier}', but ${resolved} does ` +
        'not exist.',
      { file: filePath, line: 1, column: 1 },
    );
  }
  const imported = analyzeSource(await file.text(), resolved, {
    requireComponent: false,
  });
  const helper = imported.helpers.find((candidate) => candidate.name === name);
  if (helper === undefined) {
    throw new TsxError(
      'TSX0336',
      `${resolved} exports no component or helper named ${name}.`,
      { file: filePath, line: 1, column: 1 },
    );
  }
  return {
    signature: {
      typeParams: helper.typeParams,
      params: helper.params,
      returnDartType: helper.returnDartType,
    },
    dartFile: dartFileFor(`${specifier}.tsx`).replace(/^\.\//, ''),
  };
};

export interface TranspileResult {
  dart: string;
  /** The name of the router this file declares, if it declares one. */
  router: string | null;
}

/**
 * The Dart for one file, plus what the project around it must know.
 *
 * The build wires the app's router into the entry point, and only the
 * compiler can say which file declares one.
 */
export const transpileFile = async (
  input: TranspileInput,
): Promise<TranspileResult> => {
  const context = await compileContext();
  // A file of helpers, models or stores exports no component and still
  // belongs to the project — `src/lib/format.tsx` renders nothing but the
  // components that call it need its Dart file.
  const analysis = analyzeSource(input.source, input.filePath, {
    requireComponent: false,
  });
  if (
    analysis.components.length === 0 &&
    analysis.helpers.length === 0 &&
    analysis.models.length === 0 &&
    analysis.stores.length === 0 &&
    analysis.enums.length === 0 &&
    analysis.constants.length === 0 &&
    analysis.router === null
  ) {
    throw new TsxError(
      'TSX0103',
      'this file declares nothing: export a component, a helper, a model, ' +
        'an enum, a store, a router or a constant.',
      { file: input.filePath, line: 1, column: 1 },
    );
  }
  const imported = await loadImportedComponents(analysis, input.filePath);
  const plugins = await loadPlugins(analysis, input.pluginApiDirs ?? []);
  const fileContext = {
    ...context,
    constants: new Map([
      ...imported.constants,
      ...analysis.constants.map((constant): [string, string] => [
        constant.name,
        constant.dartType,
      ]),
    ]),
    userWidgets: new Map([
      ...plugins.pluginWidgets,
      ...imported.widgets,
      ...buildUserWidgets(analysis.components),
    ]),
    // A plugin widget is imported from its package, the same way a sibling
    // component is imported from its file.
    componentImports: new Map([
      ...plugins.pluginWidgetImports,
      ...imported.componentImports,
    ]),
    stores: new Map(
      [...imported.stores.values(), ...analysis.stores].map((store) => [
        store.name,
        lowerStore(store),
      ]),
    ),
    models: new Map(
      [...imported.models.values(), ...analysis.models].map((model) => [
        model.name,
        lowerModel(
          model,
          new Set(
            [...imported.models.values(), ...analysis.models].map(
              (each) => each.name,
            ),
          ),
        ),
      ]),
    ),
    enumMembers: new Map(
      analysis.enums.map((entity): [string, Map<string, string>] => [
        entity.name,
        new Map(entity.members.map((member) => [member.name, member.dartName])),
      ]),
    ),
    helperReturns: new Map<string, HelperSignature>([
      // A helper from a sibling file reads the same as one declared here.
      ...imported.helperReturns,
      ...analysis.helpers.map((helper): [string, HelperSignature] => [
        helper.name,
        {
          typeParams: helper.typeParams,
          params: helper.params,
          returnDartType: helper.returnDartType,
        },
      ]),
    ]),
    ...plugins,
  };
  const components = analysis.components.map((component) =>
    lowerComponent(component, fileContext),
  );
  // A helper may decode a model, which needs `dart:convert` on the file.
  // A prefix belongs to the import, so it is recorded with it: `dart:math`
  // is reached through `math.` in the Dart that uses it.
  const helperImports = new Map<string, string | null>();
  const helpers = analysis.helpers.map((helper) =>
    lowerHelper(helper, fileContext, (uri, prefix) =>
      helperImports.set(uri, prefix ?? null),
    ),
  );
  for (const dartFile of imported.dartImports) {
    helperImports.set(dartFile, null);
  }
  const enums = analysis.enums.map((entity): IrEnum => ({
    name: entity.name,
    dartType: entity.dartType,
    members: entity.members.map((member) => ({
      dartName: member.dartName,
      value: member.value,
    })),
  }));
  const router = analysis.router === null ? null : lowerRouter(analysis.router);
  const dart = emitDartFile(components, fileContext, {
    helpers,
    enums,
    // Data can need a library too — `dart:math` for a computed constant — so
    // its imports join the file's, exactly as a helper's do.
    constants: analysis.constants.map((constant) =>
      lowerConstant(constant, fileContext, (uri, prefix) =>
        helperImports.set(uri, prefix ?? null),
      ),
    ),
    // An imported store belongs to the file that declares it.
    stores: [...fileContext.stores.values()].filter(
      (store) => !imported.stores.has(store.instanceName),
    ),
    router,
    // An imported model belongs to the file that declares it.
    models: [...fileContext.models.values()].filter(
      (model) => !imported.models.has(model.name),
    ),
    dartImports: [...helperImports].map(([uri, prefix]) => ({ uri, prefix })),
  });
  return { dart, router: router === null ? null : router.name };
};

/** The Dart for one file, for callers that need nothing else about it. */
export const transpileComponent = async (
  input: TranspileInput,
): Promise<string> => (await transpileFile(input)).dart;
