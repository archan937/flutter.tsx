import type { ApiSnapshot, ParamModel, TypeNode } from '../api/model';

export interface ValueForms {
  constantMembers: Map<string, Map<string, string>>;
  constructibles: Map<string, ParamModel[]>;
}

export const EDGE_INSETS_TYPES: ReadonlySet<string> = new Set([
  'EdgeInsets',
  'EdgeInsetsGeometry',
]);

export const HEX_COLOR_TYPE = 'Color';

export const hasValueForms = (name: string, forms: ValueForms): boolean =>
  EDGE_INSETS_TYPES.has(name) ||
  name === HEX_COLOR_TYPE ||
  forms.constantMembers.has(name) ||
  forms.constructibles.has(name);

const namedTypeRefs = (node: TypeNode, into: Set<string>): void => {
  switch (node.kind) {
    case 'named':
      into.add(node.name);
      break;
    case 'nullable':
      namedTypeRefs(node.inner, into);
      break;
    case 'list':
    case 'set':
    case 'future':
      namedTypeRefs(node.item, into);
      break;
    case 'map':
      namedTypeRefs(node.key, into);
      namedTypeRefs(node.value, into);
      break;
    case 'function':
      namedTypeRefs(node.returnType, into);
      for (const param of node.params) {
        namedTypeRefs(param.type, into);
      }
      break;
    default:
      break;
  }
};

export const reachableValueFormNames = (
  snapshot: ApiSnapshot,
  forms: ValueForms,
): Set<string> => {
  const queue = new Set<string>();
  for (const entity of snapshot.entities) {
    if (entity.kind !== 'widget') {
      continue;
    }
    const constructor = entity.constructors.find(
      (candidate) => candidate.name === '',
    );
    for (const param of constructor?.params ?? []) {
      namedTypeRefs(param.type, queue);
    }
  }

  for (const name of queue) {
    for (const param of forms.constructibles.get(name) ?? []) {
      namedTypeRefs(param.type, queue);
    }
  }

  return new Set(
    [...queue]
      .filter((name) => hasValueForms(name, forms))
      .sort((first, second) => first.localeCompare(second)),
  );
};

interface ConstantCandidate {
  member: string;
  owner: string;
}

const sortedMap = <TValue>(entries: [string, TValue][]): Map<string, TValue> =>
  new Map(entries.sort(([first], [second]) => first.localeCompare(second)));

const resolveOwners = (
  candidates: ConstantCandidate[],
  typeName: string,
): Map<string, string> => {
  const ownerCounts = new Map<string, number>();
  for (const candidate of candidates) {
    ownerCounts.set(
      candidate.owner,
      (ownerCounts.get(candidate.owner) ?? 0) + 1,
    );
  }

  const wins = (challenger: string, incumbent: string): boolean => {
    if (challenger === typeName || incumbent === typeName) {
      return challenger === typeName;
    }
    const challengerCount = ownerCounts.get(challenger) ?? 0;
    const incumbentCount = ownerCounts.get(incumbent) ?? 0;
    if (challengerCount !== incumbentCount) {
      return challengerCount > incumbentCount;
    }
    return challenger.localeCompare(incumbent) < 0;
  };

  const byMember = new Map<string, string>();
  for (const candidate of candidates) {
    const incumbent = byMember.get(candidate.member);
    if (incumbent === undefined || wins(candidate.owner, incumbent)) {
      byMember.set(candidate.member, candidate.owner);
    }
  }
  return sortedMap([...byMember.entries()]);
};

export const deriveValueForms = (snapshot: ApiSnapshot): ValueForms => {
  const candidatesByType = new Map<string, ConstantCandidate[]>();
  const constructibles: [string, ParamModel[]][] = [];

  for (const entity of snapshot.entities) {
    if (entity.kind === 'enum') {
      continue;
    }

    for (const constant of entity.constants) {
      if (constant.type.kind !== 'named') {
        continue;
      }
      const assignableTo = [
        constant.type.name,
        ...(snapshot.hierarchy[constant.type.name] ?? []),
      ];
      for (const typeName of assignableTo) {
        const candidates = candidatesByType.get(typeName) ?? [];
        candidates.push({ member: constant.name, owner: entity.name });
        candidatesByType.set(typeName, candidates);
      }
    }

    if (entity.kind !== 'class') {
      continue;
    }
    const defaultConstructor = entity.constructors.find(
      (constructor) => constructor.name === '',
    );
    if (
      defaultConstructor !== undefined &&
      defaultConstructor.isConst &&
      !defaultConstructor.paramMemberAsserts &&
      defaultConstructor.params.length > 0 &&
      defaultConstructor.params.every(
        (candidate) => candidate.named && !candidate.required,
      )
    ) {
      constructibles.push([entity.name, defaultConstructor.params]);
    }
  }

  const constantMembers = sortedMap(
    [...candidatesByType.entries()].map(([typeName, candidates]) => [
      typeName,
      resolveOwners(candidates, typeName),
    ]),
  );
  return { constantMembers, constructibles: sortedMap(constructibles) };
};
