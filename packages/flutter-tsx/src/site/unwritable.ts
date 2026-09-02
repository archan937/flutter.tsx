import type { TypeNode } from '../api/model';
import type { Constructible } from './synthesize';

/**
 * Why a value cannot be written in TSX.
 *
 * A prop the compiler cannot fill is not left as a mystery: it is one of
 * these, and which one is derived from the SDK rather than decided by hand.
 * The two are answered very differently — one is a value Flutter hands you,
 * the other is work still to do — and saying which is the difference between
 * a documented boundary and a gap nobody admitted to.
 */
export type Unwritable =
  /** Nothing in the SDK builds one: Flutter hands the value to the widget. */
  | 'supplied-by-flutter'
  /** A shape the compiler does not write yet, e.g. a named-parameter typedef. */
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
 * Which of the two a prop is.
 *
 * A type with no way to build one — no constructor of its own, and no
 * concrete subclass with one — is a value the framework supplies: a
 * `FlutterView`, a `PlatformViewController`, the delegate an app subclasses
 * in Dart. Everything else is a shape the compiler has yet to write.
 */
export const unwritableReason = (
  type: TypeNode,
  construction: ReadonlyMap<string, Constructible>,
): Unwritable => {
  const resolved = named(type);
  if (resolved.kind !== 'named') {
    return 'not-yet-expressible';
  }
  return construction.has(resolved.name)
    ? 'not-yet-expressible'
    : 'supplied-by-flutter';
};
