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
