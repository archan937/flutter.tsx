import { describe, expect, test } from 'bun:test';
import ts from 'typescript';

import type { AnimationBinding } from '@src/compiler/analyze';
import {
  animationCallLine,
  lowerAnimations,
  tickerMixin,
  tweenCall,
} from '@src/compiler/animation';

const binding = (
  name: string,
  overrides: Partial<AnimationBinding> = {},
): AnimationBinding => ({
  name,
  durationMs: 600,
  autoplay: false,
  repeat: false,
  node: ts.factory.createCallExpression(
    ts.factory.createIdentifier('useAnimation'),
    undefined,
    [],
  ),
  ...overrides,
});

const asMember = (name: string): string => `_${name}`;

const expressionOf = (source: string): ts.Expression => {
  const file = ts.createSourceFile(
    'probe.ts',
    `const probe = ${source};`,
    ts.ScriptTarget.ESNext,
    true,
  );
  const [statement] = file.statements;
  if (statement === undefined || !ts.isVariableStatement(statement)) {
    throw new Error('expected a variable statement');
  }
  const initializer = statement.declarationList.declarations[0]?.initializer;
  if (initializer === undefined) {
    throw new Error('expected an initializer');
  }
  return initializer;
};

describe('lowerAnimations', () => {
  test('a lone animation takes the single-ticker mixin', () => {
    const [only] = lowerAnimations([binding('fade')], asMember);

    expect(only?.mixin).toBe('SingleTickerProviderStateMixin');
    expect(only?.disposal).toBe('_fade.dispose();');
    expect(only?.field.initializer).toBe(
      'AnimationController(\n' +
        '    vsync: this,\n' +
        '    duration: const Duration(milliseconds: 600),\n' +
        '  )',
    );
  });

  test('more than one needs the mixin that provides many tickers', () => {
    expect(tickerMixin([binding('fade'), binding('slide')])).toBe(
      'TickerProviderStateMixin',
    );
  });

  test('an animation that plays itself says so where it is made', () => {
    const [autoplay] = lowerAnimations(
      [binding('in', { autoplay: true })],
      asMember,
    );
    const [repeat] = lowerAnimations(
      [binding('spin', { repeat: true })],
      asMember,
    );

    expect(autoplay?.startCall).toBe('forward');
    expect(autoplay?.field.initializer?.endsWith('..forward()')).toBe(true);
    // Repeating is what it does from the start, so it wins over playing once.
    expect(repeat?.startCall).toBe('repeat');
    expect(repeat?.field.initializer?.endsWith('..repeat()')).toBe(true);
  });
});

describe('animationCallLine', () => {
  const isAnimation = (name: string): boolean => name === 'fade';

  test('a control the handle offers is the Dart call it is', () => {
    expect(
      animationCallLine(expressionOf('fade.reverse()'), isAnimation, asMember),
    ).toBe('_fade.reverse();');
  });

  test('anything else is not one', () => {
    // Not a call, not on an animation, not a control, and not argument-free:
    // each is someone else's statement to lower.
    expect(
      animationCallLine(expressionOf('fade'), isAnimation, asMember),
    ).toBeNull();
    expect(
      animationCallLine(expressionOf('other.forward()'), isAnimation, asMember),
    ).toBeNull();
    expect(
      animationCallLine(expressionOf('fade.wobble()'), isAnimation, asMember),
    ).toBeNull();
    expect(
      animationCallLine(expressionOf('fade.forward(1)'), isAnimation, asMember),
    ).toBeNull();
    expect(
      animationCallLine(
        expressionOf('fade.a.forward()'),
        isAnimation,
        asMember,
      ),
    ).toBeNull();
  });
});

describe('tweenCall', () => {
  const isAnimation = (name: string): boolean => name === 'drift';

  test('reads the handle and both bounds', () => {
    const call = tweenCall(
      expressionOf("tween(drift, { from: 'topLeft', to: 'bottomRight' })"),
      isAnimation,
    );

    expect(call?.handle).toBe('drift');
    expect(call?.from.getText()).toBe("'topLeft'");
    expect(call?.to.getText()).toBe("'bottomRight'");
  });

  test('anything that is not a tween over an animation is not one', () => {
    const notOne = (source: string): unknown =>
      tweenCall(expressionOf(source), isAnimation);

    expect(notOne('drift')).toBeNull();
    expect(notOne('other(drift, { from: 1, to: 2 })')).toBeNull();
    expect(notOne('tween(unknown, { from: 1, to: 2 })')).toBeNull();
    expect(notOne('tween(drift.value, { from: 1, to: 2 })')).toBeNull();
    expect(notOne('tween(drift, range)')).toBeNull();
    expect(notOne('tween(drift, { to: 2 })')).toBeNull();
    expect(notOne('tween(drift, { from: 1 })')).toBeNull();
    expect(notOne('tween(drift)')).toBeNull();
  });
});
