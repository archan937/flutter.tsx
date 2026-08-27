// Compile targets: the transpiler rewrites hook calls from the AST; at
// TypeScript runtime they only need to be inert and deterministic.

import type { FlutterElement } from './types';

export type StateSetter<TValue> = (value: TValue) => void;

export const useState = <TValue>(
  initial: TValue,
): [TValue, StateSetter<TValue>] => [initial, (): void => undefined];

export type EffectCleanup = (() => void) | undefined;

export const useEffect = (
  _effect: () => EffectCleanup | void,
  _dependencies?: readonly unknown[],
): void => undefined;

export interface AsyncOptions {
  loading: () => FlutterElement;
  error: (message: string) => FlutterElement;
}

// Compile target: the transpiler reads the call from the AST and generates a
// FutureBuilder; the awaited value is the resolved data in that scope.
export const useAsync = <TValue>(
  _load: () => Promise<TValue>,
  _options: AsyncOptions,
): Promise<TValue> => Promise.reject(new Error('useAsync is compile-time'));

// Same compile-time contract as useAsync, over a Dart Stream: the awaited
// value is the latest event inside the generated StreamBuilder.
export const useStream = <TValue>(
  _source: () => AsyncIterable<TValue>,
  _options: AsyncOptions,
): Promise<TValue> => Promise.reject(new Error('useStream is compile-time'));

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
}

export const useNavigation = (): Navigation => ({
  push: (): void => undefined,
  replace: (): void => undefined,
  go: (): void => undefined,
  pop: (): void => undefined,
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
