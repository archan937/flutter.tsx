import { describe, expect, test } from 'bun:test';

import { useEffect, useState } from '@src/runtime/hooks';

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
