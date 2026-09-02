import type {
  ApiSnapshot,
  ClassEntity,
  ConstructorModel,
  ParamModel,
  WidgetEntity,
} from '../api/model';
import type { SlotMap, WidgetSlots } from '../derive/slots';
import {
  deriveValueForms,
  reachableValueFormNames,
  type ValueForms,
} from '../derive/value-forms';
import { isOwnedValue } from '../generate/emit';
import { CHILDREN_TS_TYPES, propTsType } from '../generate/prop-type';
import { jsxPropName } from '../generate/renames';
import type {
  SiteCoreEntry,
  SiteExample,
  SitePage,
  SitePlugin,
  SiteProp,
  SiteWidget,
} from './model';
import {
  type Constructible,
  type Supplier,
  type SynthesisContext,
  synthesizeTsx,
} from './synthesize';
import { buildSiteTypes } from './types';

const EMPTY_SLOTS: WidgetSlots = { children: null, slots: [] };

const dartParamLine = (param: ParamModel): string => {
  const requiredPrefix = param.named && param.required ? 'required ' : '';
  const defaultSuffix =
    param.defaultValue === null ? '' : ` = ${param.defaultValue}`;
  return `  ${requiredPrefix}${param.display} ${param.name}${defaultSuffix},`;
};

export const dartSignature = (
  widgetName: string,
  constructor: ConstructorModel,
): string => {
  const positional = constructor.params.filter((param) => !param.named);
  const named = constructor.params.filter((param) => param.named);
  if (positional.length === 0 && named.length === 0) {
    return `${widgetName}()`;
  }

  const lines: string[] = [];
  if (positional.length > 0) {
    lines.push(`${widgetName}(`);
    for (const [index, param] of positional.entries()) {
      const line = dartParamLine(param);
      const isLastPositional = index === positional.length - 1;
      lines.push(
        isLastPositional && named.length > 0 ? `${line.slice(0, -1)}, {` : line,
      );
    }
  } else {
    lines.push(`${widgetName}({`);
  }
  for (const param of named) {
    lines.push(dartParamLine(param));
  }
  lines.push(named.length > 0 ? '})' : ')');
  return lines.join('\n');
};

/**
 * How a value of each type is made.
 *
 * A class the SDK builds is made by its own constructor. An abstract one is
 * made by a concrete subclass — `ImageProvider` by `AssetImage` — and the
 * one chosen is the simplest to write, so an example shows the shortest true
 * way rather than an arbitrary one.
 */
const constructionMap = (
  snapshot: ApiSnapshot,
): Map<string, Constructible[]> => {
  const classes = snapshot.entities.filter(
    (entity): entity is ClassEntity => entity.kind === 'class',
  );
  const buildable = new Map<string, Constructible>();
  for (const entity of classes) {
    // A `dart:ui` class shares its name with a Flutter one, so the compiler
    // refuses to construct it plainly and no example may show it. An
    // abstract class cannot be built at all — only a subclass of it can.
    if (
      entity.isAbstract ||
      (snapshot.exports[entity.name] ?? []).join() === 'ui'
    ) {
      continue;
    }
    // An unnamed constructor is how a class is usually built; one that has
    // only named constructors is built by the simplest of those.
    const unnamed = entity.constructors.find(
      (candidate) => candidate.name === '',
    );
    const byName = [...entity.constructors]
      .filter((candidate) => candidate.name !== '')
      .sort(
        (first, second) =>
          first.params.filter((param) => param.required).length -
            second.params.filter((param) => param.required).length ||
          first.name.localeCompare(second.name),
      );
    const constructor = unnamed ?? byName[0];
    if (constructor !== undefined) {
      buildable.set(entity.name, {
        name: entity.name,
        ...(constructor.name === ''
          ? {}
          : { constructorName: constructor.name }),
        params: constructor.params,
        typeParams: entity.typeParams,
      });
    }
  }

  const simplest = (first: Constructible, second: Constructible): number => {
    const cost = (candidate: Constructible): number =>
      candidate.params.filter((param) => param.required).length;
    return cost(first) - cost(second) || first.name.localeCompare(second.name);
  };
  const construction = new Map(
    [...buildable].map(([name, built]): [string, Constructible[]] => [
      name,
      [built],
    ]),
  );
  for (const entity of classes) {
    for (const supertype of entity.supertypes) {
      const built = buildable.get(entity.name);
      if (built === undefined || buildable.has(supertype)) {
        continue;
      }
      // Every subclass is a way to satisfy the base; which one an example
      // can use depends on what the site asked for, so all are kept.
      const binds = entity.supertypeBindings[supertype];
      construction.set(supertype, [
        ...(construction.get(supertype) ?? []),
        { ...built, ...(binds === undefined ? {} : { binds }) },
      ]);
    }
  }
  // Simplest first, so an example shows the shortest true way to write one.
  for (const candidates of construction.values()) {
    candidates.sort(simplest);
  }
  return construction;
};

/**
 * Which static hands over each type the framework supplies.
 *
 * `View.of(context)` gives a `FlutterView`, `DefaultAssetBundle.of(context)`
 * an `AssetBundle`. Only a static taking exactly the build context counts:
 * anything else needs values of its own, which is a different question.
 */
const supplierMap = (snapshot: ApiSnapshot): Map<string, Supplier[]> => {
  const suppliers = new Map<string, Supplier[]>();
  for (const entity of snapshot.entities) {
    if (entity.kind === 'enum') {
      continue;
    }
    for (const method of entity.statics) {
      const returned =
        method.returnType.kind === 'nullable'
          ? method.returnType.inner
          : method.returnType;
      if (returned.kind !== 'named') {
        continue;
      }
      // A static handing back a subclass supplies the base too:
      // `initSurfaceAndroidView` gives a `PlatformViewController`.
      const supplied = [
        returned.name,
        ...(snapshot.hierarchy[returned.name] ?? []),
      ];
      for (const name of supplied) {
        suppliers.set(name, [
          ...(suppliers.get(name) ?? []),
          { owner: entity.name, method: method.name, params: method.params },
        ]);
      }
    }
  }
  // The plainest accessor first: fewest arguments, then the shorter name —
  // `View.of(context)` before `View.maybeOf(context)`.
  for (const candidates of suppliers.values()) {
    candidates.sort(
      (first, second) =>
        first.params.filter((param) => param.required).length -
          second.params.filter((param) => param.required).length ||
        first.method.length - second.method.length ||
        first.method.localeCompare(second.method),
    );
  }
  return suppliers;
};

const synthesisContext = (
  snapshot: ApiSnapshot,
  forms: ValueForms,
  widgetExamples: ReadonlyMap<string, string> = new Map(),
): SynthesisContext => {
  const enumValues: Record<string, string> = {};
  for (const entity of snapshot.entities) {
    if (entity.kind === 'enum') {
      const firstValue = entity.values[0];
      if (firstValue !== undefined) {
        enumValues[entity.name] = firstValue.name;
      }
    }
  }
  return {
    enumValues,
    forms,
    ownedValues: new Set(
      snapshot.entities.filter(isOwnedValue).map((entity) => entity.name),
    ),
    construction: constructionMap(snapshot),
    widgetExamples,
    formNames: reachableValueFormNames(snapshot, forms),
    declaredTypes: new Set(snapshot.entities.map((entity) => entity.name)),
    suppliers: supplierMap(snapshot),
    valueOnlyNames: new Set(
      snapshot.entities
        .filter(
          (entity) => entity.kind !== 'enum' && entity.constants.length > 0,
        )
        .map((entity) => entity.name),
    ),
  };
};

const propRows = (
  constructor: ConstructorModel,
  widgetSlots: WidgetSlots,
  formNames: ReadonlySet<string>,
): SiteProp[] => {
  const takenNames = new Set(constructor.params.map((param) => param.name));
  const rows: SiteProp[] = [];

  const childrenSource = constructor.params.find(
    (param) => param.name === widgetSlots.children?.param,
  );
  if (widgetSlots.children !== null && childrenSource !== undefined) {
    rows.push({
      tsxProp: 'children',
      tsType: CHILDREN_TS_TYPES[widgetSlots.children.kind],
      dartType: childrenSource.display,
      required: childrenSource.required,
    });
  }

  for (const param of constructor.params) {
    if (param.name === 'key' || param.name === widgetSlots.children?.param) {
      continue;
    }
    rows.push({
      tsxProp: jsxPropName(param.name, takenNames),
      tsType: propTsType(param, widgetSlots, formNames),
      dartType: param.display,
      required: param.required,
    });
  }
  return rows;
};

/** What the reference documents beside the SDK: derived elsewhere, verified there. */
export interface SiteSections {
  examples: SiteExample[];
  coreApi: SiteCoreEntry[];
  plugins: SitePlugin[];
  /** Generated declaration files the value types are read from. */
  generatedFiles: string[];
}

/** Each widget whose example is one self-contained tag, as that tag. */
const widgetTags = (
  snapshot: ApiSnapshot,
  slots: SlotMap,
  context: SynthesisContext,
): Map<string, string> => {
  const tags = new Map<string, string>();
  for (const entity of snapshot.entities) {
    const constructor =
      entity.kind === 'widget'
        ? entity.constructors.find((candidate) => candidate.name === '')
        : undefined;
    if (entity.kind !== 'widget' || constructor === undefined) {
      continue;
    }
    const example = synthesizeTsx({
      widgetName: entity.name,
      params: constructor.params,
      slots: slots[entity.name] ?? EMPTY_SLOTS,
      context,
      requiredOneOf: constructor.requiredOneOf,
    });
    // Only one that stands alone can be quoted inside another example: one
    // with a binding needs a component around it, and there is none here.
    if (example.complete && example.bindings.length === 0) {
      tags.set(entity.name, example.tsx.replaceAll('\n', ' ').trim());
    }
  }
  return tags;
};

export const buildSitePage = (
  snapshot: ApiSnapshot,
  slots: SlotMap,
  sections: SiteSections,
): SitePage => {
  const forms = deriveValueForms(snapshot);
  const formNames = reachableValueFormNames(snapshot, forms);
  // A prop may ask for a widget by name — `CupertinoTabScaffold` wants a
  // `CupertinoTabBar` — and the way to write one is that widget's own
  // example. They are synthesized once to be quoted by the second pass.
  const context = synthesisContext(
    snapshot,
    forms,
    widgetTags(snapshot, slots, synthesisContext(snapshot, forms)),
  );
  const widgets: SiteWidget[] = [];
  const incompleteExamples: string[] = [];

  for (const entity of snapshot.entities) {
    if (entity.kind !== 'widget') {
      continue;
    }
    const widget: WidgetEntity = entity;
    const constructor = widget.constructors.find(
      (candidate) => candidate.name === '',
    );
    if (constructor === undefined) {
      continue;
    }

    const widgetSlots = slots[widget.name] ?? EMPTY_SLOTS;
    const example = synthesizeTsx({
      widgetName: widget.name,
      params: constructor.params,
      slots: widgetSlots,
      context,
      requiredOneOf: constructor.requiredOneOf,
    });
    if (!example.complete) {
      incompleteExamples.push(widget.name);
    }
    widgets.push({
      name: widget.name,
      library: widget.library,
      doc: widget.doc,
      props: propRows(constructor, widgetSlots, formNames),
      example,
      dartSignature: dartSignature(widget.name, constructor),
    });
  }

  return {
    flutterVersion: snapshot.meta.frameworkVersion,
    examples: sections.examples,
    coreApi: sections.coreApi,
    widgets,
    types: buildSiteTypes(sections.generatedFiles, widgets),
    enums: snapshot.entities.flatMap((entity) =>
      entity.kind === 'enum'
        ? [
            {
              name: entity.name,
              library: entity.library,
              doc: entity.doc,
              values: entity.values.map((value) => value.name),
            },
          ]
        : [],
    ),
    plugins: sections.plugins,
    incompleteExamples,
  };
};
