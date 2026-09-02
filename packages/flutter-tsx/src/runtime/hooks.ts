// Compile targets: the transpiler rewrites hook calls from the AST; at
// TypeScript runtime they only need to be inert and deterministic.

import type {
  Animation,
  AnimationController,
  BuildContext,
} from '../generated/widgets';
import type { FlutterElement } from './types';

export type StateSetter<TValue> = (value: TValue) => void;

export const useState = <TValue>(
  initial: TValue,
): [TValue, StateSetter<TValue>] => [initial, (): void => undefined];

export type EffectCleanup = (() => void) | undefined;

export const useEffect: (
  effect: () => EffectCleanup | void,
  dependencies?: readonly unknown[],
) => void = () => undefined;

export interface AsyncOptions {
  loading: () => FlutterElement;
  error: (message: string) => FlutterElement;
}

// Compile target: the transpiler reads the call from the AST and generates a
// FutureBuilder; the awaited value is the resolved data in that scope.
export const useAsync: <TValue>(
  load: () => Promise<TValue>,
  options: AsyncOptions,
) => Promise<TValue> = () =>
  Promise.reject(new Error('useAsync is compile-time'));

// Same compile-time contract as useAsync, over a Dart Stream: the awaited
// value is the latest event inside the generated StreamBuilder.
export const useStream: <TValue>(
  source: () => AsyncIterable<TValue>,
  options: AsyncOptions,
) => Promise<TValue> = () =>
  Promise.reject(new Error('useStream is compile-time'));

/**
 * The context a widget is built in.
 *
 * Flutter hands values over through it — `MediaQuery.of(context)`,
 * `View.of(context)` — and this is how a component names it. Compile
 * target: the transpiler reads the call from the AST and uses the
 * `BuildContext` the build already has.
 */
export const useBuildContext: () => BuildContext = () => {
  throw new Error('useBuildContext is compile-time');
};

/**
 * An animation a component drives itself, where `Animated` is not enough:
 * the handle is the `Animation` a transition takes, and its methods are the
 * controls Flutter's own controller has.
 */
export interface AnimationHandle extends AnimationController {
  /** Runs from where it is to the end. */
  readonly forward: () => void;
  /** Runs back to the start. */
  readonly reverse: () => void;
  /** Stops where it is. */
  readonly stop: () => void;
  /** Runs from the start, over and over. */
  readonly repeat: () => void;
  /** Jumps back to the start. */
  readonly reset: () => void;
}

export interface AnimationOptions {
  /** How long one run takes, in milliseconds. */
  duration: number;
  /** Runs as soon as the widget is mounted. */
  autoplay?: boolean;
  /** Keeps running from the start, for as long as the widget is mounted. */
  repeat?: boolean;
}

/**
 * Compile target: the transpiler reads the call from the AST and generates an
 * `AnimationController` the State owns — ticker, disposal and all.
 */
export const useAnimation: (
  options: AnimationOptions,
) => AnimationHandle = () => {
  throw new Error('useAnimation is compile-time');
};

/**
 * An animation over values that are not numbers.
 *
 * `useAnimation` runs from 0 to 1; a transition over colours, alignments or
 * offsets runs between two of those. `tween` is that range, driven by the
 * same handle — Flutter's own `Tween(...).animate(controller)`.
 */
export const tween: <TValue>(
  animation: AnimationHandle,
  range: { from: TValue; to: TValue },
) => Animation = () => {
  throw new Error('tween is compile-time');
};

/**
 * A module-level store. The transpiler reads the initial shape from the AST
 * and generates a ChangeNotifier plus one instance; at TypeScript runtime the
 * handle only needs to carry the value's type.
 */
export interface Store<TState extends object> {
  readonly initial: TState;
}

export const createStore = <TState extends object>(
  initial: TState,
): Store<TState> => ({ initial });

export type StorePatch<TState> = Partial<TState>;

export const useStore = <TState extends object>(
  store: Store<TState>,
): [TState, (patch: StorePatch<TState>) => void] => [
  store.initial,
  (): void => undefined,
];

/**
 * Navigation inside a component. The transpiler rewrites each call onto
 * go_router's BuildContext extension, so no navigator is threaded by hand.
 */
export interface Navigation {
  push: (location: string) => void;
  replace: (location: string) => void;
  go: (location: string) => void;
  pop: () => void;
  /** Opens the widget as a dialog (`showDialog`). */
  present: (modal: FlutterElement) => void;
  /** Opens the widget as a bottom sheet (`showModalBottomSheet`). */
  presentSheet: (sheet: FlutterElement) => void;
}

export const useNavigation = (): Navigation => ({
  push: (): void => undefined,
  replace: (): void => undefined,
  go: (): void => undefined,
  pop: (): void => undefined,
  present: (): void => undefined,
  presentSheet: (): void => undefined,
});

/**
 * A routable component takes no props: the router supplies nothing but the
 * location, so a component needing props cannot be a route target — TypeScript
 * rejects it rather than the Dart compiler.
 */
export type RouteTarget = () => FlutterElement;

/** A route table: each path renders one component. */
export interface RouterConfig {
  readonly routes: Record<string, RouteTarget>;
}

export const createRouter = (
  routes: Record<string, RouteTarget>,
): RouterConfig => ({ routes });

/**
 * Decodes a JSON body into an interface declared in the same file:
 *
 * ```tsx
 * const album = json(res.body) as Album;
 * ```
 *
 * The transpiler generates a Dart data class with a `fromJson` factory and
 * rewrites the call to
 * `Album.fromJson(jsonDecode(res.body) as Map<String, dynamic>)`; at
 * TypeScript runtime it only needs to parse. `unknown` is deliberate: the
 * cast is where the model is named, which is how TypeScript code normally
 * types a parsed body, and it means the value cannot be used untyped.
 */
export const json = (body: string): unknown => JSON.parse(body);
