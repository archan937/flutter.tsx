import { describe, expect, test } from 'bun:test';

import { useAsync, useEffect, useState } from '@src/runtime/hooks';

describe('useState (compile-target stub)', () => {
  test('returns the initial value and an inert setter', () => {
    const [taken, setTaken] = useState(false);
    setTaken(true);

    expect(taken).toBe(false);
  });
});

describe('useEffect (compile-target stub)', () => {
  test('accepts an effect without running it', () => {
    let ran = false;
    useEffect(() => {
      ran = true;
    }, []);

    expect(ran).toBe(false);
  });
});

describe('useAsync (compile-target stub)', () => {
  test('rejects at runtime: it only exists for the compiler to read', () => {
    expect(
      useAsync(() => Promise.resolve(1), {
        loading: () => ({ widgetName: 'Text', props: {} }),
        error: () => ({ widgetName: 'Text', props: {} }),
      }),
    ).rejects.toThrow(new Error('useAsync is compile-time'));
  });
});
