import type {
  ApiSnapshot,
  ClassEntity,
  Entity,
  FieldModel,
  StaticMethod,
  TypeNode,
} from '../api/model';

/**
 * A class an app writes itself.
 *
 * Most of Flutter is built (`Offset(1, 1)`), handed over
 * (`MediaQuery.of(context)`) or answered (`gradient.createShader(rect)`).
 * A handful of classes are none of those: a `MultiChildLayoutDelegate`, a
 * `DataTableSource`, a `SliverPersistentHeaderDelegate` exist only as the
 * subclass an app writes, which is why a widget asking for one cannot be
 * written without a way to write the class. `defineDelegate` is that way,
 * and this is the set it covers — derived from the SDK, never listed by
 * hand, so a delegate Flutter adds is one TSX can write the day it lands.
 */
export interface DelegateDefinition {
  name: string;
  library: string;
  doc: string;
  /**
   * The mixin the written class needs: a `Listenable` is written by mixing
   * in `ChangeNotifier`, which is what Flutter's own delegates do.
   */
  mixin: string | null;
  /** The names the class is generic over: the `T` of a `RouterDelegate<T>`. */
  typeParams: string[];
  /**
   * What fills each of those, in the same order, which is the bound of each:
   * `class _Nav extends RouterDelegate<Object>`.
   */
  typeArguments: string[];
  /** The methods being this class means writing. */
  methods: StaticMethod[];
  /** The getters it means writing: a header delegate's `minExtent`. */
  getters: FieldModel[];
}

/** Every named type a signature mentions, however deeply nested. */
const namesIn = (node: TypeNode, into: Set<string>): void => {
  switch (node.kind) {
    case 'named':
      into.add(node.name);
      for (const arg of node.args ?? []) {
        namesIn(arg, into);
      }
      return;
    case 'nullable':
      namesIn(node.inner, into);
      return;
    case 'future':
    case 'stream':
    case 'list':
    case 'set':
      namesIn(node.item, into);
      return;
    case 'map':
      namesIn(node.key, into);
      namesIn(node.value, into);
      return;
    case 'function':
      namesIn(node.returnType, into);
      for (const param of node.params) {
        namesIn(param.type, into);
      }
      break;
    // A scalar, a widget, a void: nothing named to collect.
    default:
      break;
  }
};

/** The types something in the SDK returns, reads out or holds as a constant. */
const answeredNames = (snapshot: ApiSnapshot): ReadonlySet<string> => {
  const answered = new Set<string>();
  for (const entity of snapshot.entities) {
    if (entity.kind === 'enum') {
      continue;
    }
    for (const method of [...entity.statics, ...entity.methods]) {
      namesIn(method.returnType, answered);
    }
    for (const getter of entity.staticGetters) {
      namesIn(getter.type, answered);
    }
    for (const constant of entity.constants) {
      namesIn(constant.type, answered);
    }
  }
  return answered;
};

/** The names of classes that can be built, by themselves or by a subclass. */
const builtNames = (snapshot: ApiSnapshot): ReadonlySet<string> => {
  const built = new Set<string>();
  for (const entity of snapshot.entities) {
    if (entity.kind === 'enum' || entity.constructors.length === 0) {
      continue;
    }
    // An abstract class keeps only its factory constructors, and a factory
    // builds a value: `Path()` hands back a path, so nobody writes one.
    if (entity.kind === 'class' && entity.isAbstract) {
      built.add(entity.name);
      continue;
    }
    built.add(entity.name);
    for (const supertype of snapshot.hierarchy[entity.name] ?? []) {
      built.add(supertype);
    }
  }
  return built;
};

/**
 * The layers a TSX app does not subclass.
 *
 * A widget is written as a component — an exported arrow function returning
 * JSX — and an element, a render object or a layer is the framework's own
 * machinery underneath it, driven by a protocol TSX does not write. What is
 * left is the part an app really does write: delegates, sources, painters,
 * actions.
 */
const FRAMEWORK_LAYERS: ReadonlySet<string> = new Set([
  'Widget',
  'Element',
  'RenderObject',
  'Layer',
  'State',
]);

/**
 * The classes an app has to write, in name order.
 *
 * The test is what the SDK itself offers: a class with an abstract surface
 * that nothing builds, nothing hands over and nothing answers with is a
 * class that exists only as the subclass an app writes.
 */
export const deriveDelegates = (
  snapshot: ApiSnapshot,
): DelegateDefinition[] => {
  const built = builtNames(snapshot);
  const answered = answeredNames(snapshot);
  const written = (entity: Entity): entity is ClassEntity =>
    entity.kind === 'class' &&
    entity.isAbstract &&
    entity.abstractMethods.length + entity.abstractGetters.length > 0 &&
    !built.has(entity.name) &&
    !answered.has(entity.name) &&
    !(snapshot.hierarchy[entity.name] ?? []).some((supertype) =>
      FRAMEWORK_LAYERS.has(supertype),
    );
  return snapshot.entities
    .filter(written)
    .map((entity) => ({
      name: entity.name,
      library: entity.library,
      doc: entity.doc,
      mixin: entity.mixin,
      typeParams: entity.typeParams,
      typeArguments: entity.typeParamBounds,
      methods: entity.abstractMethods,
      getters: entity.abstractGetters,
    }))
    .sort((first, second) => first.name.localeCompare(second.name));
};
