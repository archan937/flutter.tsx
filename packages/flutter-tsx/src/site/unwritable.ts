import type { TypeNode } from '../api/model';
import type { Constructible } from './synthesize';

/**
 * Why a value cannot be written in TSX.
 *
 * A prop the compiler cannot fill is not left as a mystery: it is one of
 * these, and which one is derived from the SDK rather than decided by hand.
 * They are answered very differently — one is a value Flutter hands you, one
 * is a widget TSX writes another way, and only the last is work to do — and
 * saying which is the difference between a documented boundary and a gap
 * nobody admitted to.
 */
export type Unwritable =
  /** Nothing in the SDK builds one: Flutter hands the value to the widget. */
  | 'supplied-by-flutter'
  /** A hook writes this widget: `useAsync` and `useStream` generate them. */
  | 'written-by-a-hook'
  /** A shape the compiler does not write yet. */
  | 'not-yet-expressible';

export interface UnwritableProp {
  prop: string;
  /** The Dart type, as the SDK declares it. */
  type: string;
  reason: Unwritable;
}

const named = (type: TypeNode): TypeNode =>
  type.kind === 'nullable' ? named(type.inner) : type;

/**
 * Which of the three a prop is.
 *
 * A Future or a Stream is not written by hand at all: `useAsync` and
 * `useStream` are how TSX awaits, and they generate the very builders that
 * ask for these. A type with no way to build one — no constructor of its
 * own, and no concrete subclass with one — is a value the framework
 * supplies: a `FlutterView`, a `PlatformViewController`, the delegate an app
 * subclasses in Dart. Everything else is a shape the compiler has yet to
 * write.
 */
export const unwritableReason = (
  type: TypeNode,
  construction: ReadonlyMap<string, readonly Constructible[]>,
): Unwritable => {
  const resolved = named(type);
  if (resolved.kind === 'future' || resolved.kind === 'stream') {
    return 'written-by-a-hook';
  }
  if (resolved.kind !== 'named') {
    return 'not-yet-expressible';
  }
  return (construction.get(resolved.name) ?? []).length > 0
    ? 'not-yet-expressible'
    : 'supplied-by-flutter';
};
