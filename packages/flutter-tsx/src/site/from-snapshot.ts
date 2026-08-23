import type {
  ApiSnapshot,
  ConstructorModel,
  ParamModel,
  WidgetEntity,
} from '@src/api/model';
import type { SlotMap, WidgetSlots } from '@src/derive/slots';
import { CHILDREN_TS_TYPES, propTsType } from '@src/generate/prop-type';
import { jsxPropName } from '@src/generate/renames';
import type { SitePage, SiteProp, SiteWidget } from '@src/site/model';
import { type SynthesisContext, synthesizeTsx } from '@src/site/synthesize';

const EMPTY_SLOTS: WidgetSlots = { children: null, slots: [] };

const WELL_KNOWN_VALUES: Record<string, string> = {
  Color: 'Colors.blue',
  MaterialColor: 'Colors.blue',
  IconData: 'Icons.add',
  Curve: 'Curves.easeIn',
  Cubic: 'Curves.easeIn',
};

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

const synthesisContext = (snapshot: ApiSnapshot): SynthesisContext => {
  const enumValues: Record<string, string> = {};
  const constantsByType: Record<string, string> = {};

  for (const entity of snapshot.entities) {
    if (entity.kind === 'enum') {
      const firstValue = entity.values[0];
      if (firstValue !== undefined) {
        enumValues[entity.name] = firstValue.name;
      }
      continue;
    }
    for (const constant of entity.constants) {
      if (
        constant.type.kind === 'named' &&
        constantsByType[constant.type.name] === undefined
      ) {
        constantsByType[constant.type.name] = `${entity.name}.${constant.name}`;
      }
    }
  }

  return {
    enumValues,
    constantsByType: { ...constantsByType, ...WELL_KNOWN_VALUES },
  };
};

const propRows = (
  constructor: ConstructorModel,
  widgetSlots: WidgetSlots,
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
      tsType: propTsType(param, widgetSlots),
      dartType: param.display,
      required: param.required,
    });
  }
  return rows;
};

export const buildSitePage = (
  snapshot: ApiSnapshot,
  slots: SlotMap,
): SitePage => {
  const context = synthesisContext(snapshot);
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
    });
    if (!example.complete) {
      incompleteExamples.push(widget.name);
    }
    widgets.push({
      name: widget.name,
      library: widget.library,
      doc: widget.doc,
      props: propRows(constructor, widgetSlots),
      tsxExample: example.tsx,
      exampleComplete: example.complete,
      dartSignature: dartSignature(widget.name, constructor),
    });
  }

  return {
    flutterVersion: snapshot.meta.frameworkVersion,
    widgets,
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
    incompleteExamples,
  };
};
