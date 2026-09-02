import ts from 'typescript';

import type { AnimationBinding } from './analyze';
import type { IrField } from './ir';

/**
 * An animation a component drives itself.
 *
 * Flutter asks for three things around an `AnimationController` and refuses
 * to run without them: a ticker the State provides, a duration, and disposal.
 * `useAnimation` is the one place they are written, so they are generated
 * together here rather than spread across the lowering.
 */
export interface LoweredAnimation {
  field: IrField;
  /** The mixin the State needs to be a ticker provider. */
  mixin: string;
  /** `..forward()` and friends, run once the controller exists. */
  startCall: string | null;
  disposal: string;
}

const SINGLE_TICKER_MIXIN = 'SingleTickerProviderStateMixin';
const MANY_TICKERS_MIXIN = 'TickerProviderStateMixin';

/**
 * The mixin a State with these animations carries.
 *
 * One ticker takes the single-ticker mixin, which is the one Flutter's own
 * analyzer asks for; more than one needs the general mixin.
 */
export const tickerMixin = (bindings: readonly AnimationBinding[]): string =>
  bindings.length > 1 ? MANY_TICKERS_MIXIN : SINGLE_TICKER_MIXIN;

/** Flutter's own name for the control each option asks for. */
const startCall = (binding: AnimationBinding): string | null => {
  if (binding.repeat) {
    return 'repeat';
  }
  return binding.autoplay ? 'forward' : null;
};

/** One controller per binding, with the ticker mixin they share. */
export const lowerAnimations = (
  bindings: readonly AnimationBinding[],
  dartName: (name: string) => string,
): LoweredAnimation[] => {
  const mixin = tickerMixin(bindings);
  return bindings.map((binding): LoweredAnimation => {
    const name = dartName(binding.name);
    const start = startCall(binding);
    return {
      field: {
        name,
        dartType: 'AnimationController',
        mutable: false,
        // `vsync: this` reads the State the field belongs to, so the field is
        // initialized late rather than in the initializer list.
        lateFinal: true,
        initializer:
          'AnimationController(\n' +
          '    vsync: this,\n' +
          `    duration: const Duration(milliseconds: ${binding.durationMs}),\n` +
          '  )' +
          (start === null ? '' : `..${start}()`),
      },
      mixin,
      startCall: start,
      disposal: `${name}.dispose();`,
    };
  });
};

const TWEEN_HELPER = 'tween';
const RANGE_START = 'from';
const RANGE_END = 'to';

/** The parts of a `tween(handle, { from, to })` call, when it is one. */
export const tweenCall = (
  expression: ts.Expression,
  isAnimation: (name: string) => boolean,
): { handle: string; from: ts.Expression; to: ts.Expression } | null => {
  if (
    !ts.isCallExpression(expression) ||
    !ts.isIdentifier(expression.expression) ||
    expression.expression.text !== TWEEN_HELPER
  ) {
    return null;
  }
  const [handle, range] = expression.arguments;
  if (
    handle === undefined ||
    !ts.isIdentifier(handle) ||
    !isAnimation(handle.text) ||
    range === undefined ||
    !ts.isObjectLiteralExpression(range)
  ) {
    return null;
  }
  const bound = (property: string): ts.Expression | undefined =>
    range.properties.find(
      (candidate): candidate is ts.PropertyAssignment =>
        ts.isPropertyAssignment(candidate) &&
        candidate.name.getText() === property,
    )?.initializer;
  const from = bound(RANGE_START);
  const to = bound(RANGE_END);
  return from === undefined || to === undefined
    ? null
    : { handle: handle.text, from, to };
};
