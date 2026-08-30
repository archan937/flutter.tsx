import type {
  ConstantModel,
  ConstructorModel,
  ParamModel,
  TypeNode,
} from '../api/model';
import {
  asArray,
  asObject,
  asString,
  asStringOrNull,
  parseConstant,
  parseConstructor,
  parseParam,
  parseTypeNode,
} from '../api/parse';

export interface PluginMethod {
  name: string;
  doc: string;
  isStatic: boolean;
  returnType: TypeNode;
  params: ParamModel[];
}

export interface PluginField {
  name: string;
  doc: string;
  type: TypeNode;
}

export interface PluginClass {
  name: string;
  doc: string;
  constructors: ConstructorModel[];
  fields: PluginField[];
  methods: PluginMethod[];
  constants: ConstantModel[];
}

export interface PluginEnum {
  name: string;
  values: string[];
}

export interface AndroidManifestNeeds {
  manifestSource: string | null;
  permissions: string[];
  exampleSource: string | null;
  querySchemes: string[];
}

export interface IosManifestNeeds {
  exampleSource: string | null;
  usageDescriptionKeys: string[];
  querySchemes: string[];
}

export interface PluginPermissions {
  android: AndroidManifestNeeds;
  ios: IosManifestNeeds;
}

/** A top-level singleton a plugin exposes: `final trayManager = ...`. */
export interface PluginInstance {
  name: string;
  type: string;
}

export interface PluginApi {
  package: string;
  version: string;
  classes: PluginClass[];
  enums: PluginEnum[];
  functions: PluginMethod[];
  instances: PluginInstance[];
  permissions: PluginPermissions;
}

const parseCallable = (value: unknown, path: string): PluginMethod => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    doc: asString(record.doc, `${path}.doc`),
    isStatic: record.static === true,
    returnType: parseTypeNode(record.returnType, `${path}.returnType`),
    params: asArray(record.params, `${path}.params`).map((param, index) =>
      parseParam(param, `${path}.params[${index}]`),
    ),
  };
};

const parseField = (value: unknown, path: string): PluginField => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    doc: asString(record.doc, `${path}.doc`),
    type: parseTypeNode(record.type, `${path}.type`),
  };
};

const parseClass = (value: unknown, path: string): PluginClass => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    doc: asString(record.doc, `${path}.doc`),
    constructors: asArray(record.constructors, `${path}.constructors`).map(
      (constructor, index) =>
        parseConstructor(constructor, `${path}.constructors[${index}]`),
    ),
    fields: asArray(record.fields, `${path}.fields`).map((field, index) =>
      parseField(field, `${path}.fields[${index}]`),
    ),
    methods: asArray(record.methods, `${path}.methods`).map((method, index) =>
      parseCallable(method, `${path}.methods[${index}]`),
    ),
    constants: asArray(record.constants, `${path}.constants`).map(
      (constant, index) =>
        parseConstant(constant, `${path}.constants[${index}]`),
    ),
  };
};

const parseEnum = (value: unknown, path: string): PluginEnum => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    values: asArray(record.values, `${path}.values`).map((entry, index) =>
      asString(
        asObject(entry, `${path}.values[${index}]`).name,
        `${path}.values[${index}].name`,
      ),
    ),
  };
};

export const parsePluginApi = (value: unknown, label: string): PluginApi => {
  const record = asObject(value, `${label}: root`);
  return {
    package: asString(record.package, `${label}: package`),
    version: asString(record.version, `${label}: version`),
    classes: asArray(record.classes, `${label}: classes`).map((entity, index) =>
      parseClass(entity, `${label}: classes[${index}]`),
    ),
    enums: asArray(record.enums, `${label}: enums`).map((entity, index) =>
      parseEnum(entity, `${label}: enums[${index}]`),
    ),
    functions: asArray(record.functions, `${label}: functions`).map(
      (entity, index) => parseCallable(entity, `${label}: functions[${index}]`),
    ),
    instances: asArray(record.instances, `${label}: instances`).map(
      (entity, index) => {
        const instance = asObject(entity, `${label}: instances[${index}]`);
        return {
          name: asString(instance.name, `${label}: instances[${index}].name`),
          type: asString(instance.type, `${label}: instances[${index}].type`),
        };
      },
    ),
    permissions: parsePermissions(record.permissions, `${label}: permissions`),
  };
};

const asStringList = (value: unknown, path: string): string[] =>
  asArray(value, path).map((entry, index) =>
    asString(entry, `${path}[${index}]`),
  );

const parsePermissions = (value: unknown, path: string): PluginPermissions => {
  const record = asObject(value, path);
  const android = asObject(record.android, `${path}.android`);
  const ios = asObject(record.ios, `${path}.ios`);
  return {
    android: {
      manifestSource: asStringOrNull(
        android.manifestSource,
        `${path}.android.manifestSource`,
      ),
      permissions: asStringList(
        android.permissions,
        `${path}.android.permissions`,
      ),
      exampleSource: asStringOrNull(
        android.exampleSource,
        `${path}.android.exampleSource`,
      ),
      querySchemes: asStringList(
        android.querySchemes,
        `${path}.android.querySchemes`,
      ),
    },
    ios: {
      exampleSource: asStringOrNull(
        ios.exampleSource,
        `${path}.ios.exampleSource`,
      ),
      usageDescriptionKeys: asStringList(
        ios.usageDescriptionKeys,
        `${path}.ios.usageDescriptionKeys`,
      ),
      querySchemes: asStringList(ios.querySchemes, `${path}.ios.querySchemes`),
    },
  };
};

export interface ManifestRequirements {
  android: { permissions: string[]; querySchemes: string[] };
  ios: { usageDescriptionKeys: string[]; querySchemes: string[] };
  // Plugins whose artifacts were missing: their requirements are unknown,
  // not empty. A scaffolder must surface these rather than assume nothing.
  unknown: string[];
}

const sorted = (values: Iterable<string>): string[] =>
  [...new Set(values)].sort();

/// Merges what every used plugin needs a host app to declare.
export const manifestRequirements = (
  apis: PluginApi[],
): ManifestRequirements => {
  const permissions: string[] = [];
  const androidSchemes: string[] = [];
  const usageKeys: string[] = [];
  const iosSchemes: string[] = [];
  const unknown: string[] = [];
  for (const api of apis) {
    const { android, ios } = api.permissions;
    permissions.push(...android.permissions);
    androidSchemes.push(...android.querySchemes);
    usageKeys.push(...ios.usageDescriptionKeys);
    iosSchemes.push(...ios.querySchemes);
    if (android.manifestSource === null) {
      unknown.push(`${api.package}: no Android manifest found`);
    }
    if (android.exampleSource === null) {
      unknown.push(`${api.package}: no example Android manifest found`);
    }
    if (ios.exampleSource === null) {
      unknown.push(`${api.package}: no example Info.plist found`);
    }
  }
  return {
    android: {
      permissions: sorted(permissions),
      querySchemes: sorted(androidSchemes),
    },
    ios: {
      usageDescriptionKeys: sorted(usageKeys),
      querySchemes: sorted(iosSchemes),
    },
    unknown,
  };
};

/**
 * Loads a plugin's extracted API.
 *
 * `searchDirs` holds project extractions written by `fsx install`, which take
 * precedence: a project's resolved version of a plugin describes it better
 * than the reference set bundled with this package, and covers plugins the
 * bundle has never seen.
 */
export const loadPluginApi = async (
  packageName: string,
  searchDirs: readonly string[] = [],
): Promise<PluginApi> => {
  const bundled = new URL(
    `../../ref/plugins/${packageName}.json`,
    import.meta.url,
  ).pathname;

  for (const location of [
    ...searchDirs.map((dir) => `${dir}/${packageName}.json`),
    bundled,
  ]) {
    const file = Bun.file(location);
    if (await file.exists()) {
      const document: unknown = await file.json();
      return parsePluginApi(document, location);
    }
  }

  throw new Error(
    `no extracted API for ${packageName} — add it to the "plugins" map in ` +
      'package.json and run `fsx install`.',
  );
};
