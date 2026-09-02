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
const constructionMap = (snapshot: ApiSnapshot): Map<string, Constructible> => {
  const classes = snapshot.entities.filter(
    (entity): entity is ClassEntity => entity.kind === 'class',
  );
  const buildable = new Map<string, Constructible>();
  for (const entity of classes) {
    const constructor = entity.constructors.find(
      (candidate) => candidate.name === '',
    );
    if (constructor !== undefined) {
      buildable.set(entity.name, {
        name: entity.name,
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
  const construction = new Map(buildable);
  const generic = new Map(
    classes.map((entity): [string, number] => [
      entity.name,
      entity.typeParams.length,
    ]),
  );
  for (const entity of classes) {
    for (const supertype of entity.supertypes) {
      const built = buildable.get(entity.name);
      const incumbent = construction.get(supertype);
      // A subclass stands in for a base only if it is generic over as much:
      // an `Animatable<T>` is not satisfied by a tween of one fixed type.
      if (
        built !== undefined &&
        (generic.get(entity.name) ?? 0) >= (generic.get(supertype) ?? 0) &&
        (incumbent === undefined || simplest(built, incumbent) < 0) &&
        !buildable.has(supertype)
      ) {
        construction.set(supertype, built);
      }
    }
  }
  return construction;
};

const synthesisContext = (
  snapshot: ApiSnapshot,
  forms: ValueForms,
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

export const buildSitePage = (
  snapshot: ApiSnapshot,
  slots: SlotMap,
  sections: SiteSections,
): SitePage => {
  const forms = deriveValueForms(snapshot);
  const context = synthesisContext(snapshot, forms);
  const formNames = reachableValueFormNames(snapshot, forms);
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
