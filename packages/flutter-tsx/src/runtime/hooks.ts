// Compile targets: the transpiler rewrites hook calls from the AST; at
// TypeScript runtime they only need to be inert and deterministic.

export type StateSetter<TValue> = (value: TValue) => void;

export const useState = <TValue>(
  initial: TValue,
): [TValue, StateSetter<TValue>] => [initial, (): void => undefined];

export type EffectCleanup = (() => void) | undefined;

export const useEffect = (
  _effect: () => EffectCleanup | void,
  _dependencies?: readonly unknown[],
): void => undefined;
