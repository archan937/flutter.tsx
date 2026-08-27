import { describe, expect, test } from 'bun:test';

import {
  createStore,
  useAsync,
  useEffect,
  useState,
  useStore,
  useStream,
} from '@src/runtime/hooks';

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

describe('useStream (compile-target stub)', () => {
  test('rejects at runtime: it only exists for the compiler to read', () => {
    const source = (): AsyncIterable<number> => ({
      [Symbol.asyncIterator]: (): AsyncIterator<number> => ({
        next: (): Promise<IteratorResult<number>> =>
          Promise.resolve({ done: true, value: 0 }),
      }),
    });

    expect(
      useStream(source, {
        loading: () => ({ widgetName: 'Text', props: {} }),
        error: () => ({ widgetName: 'Text', props: {} }),
      }),
    ).rejects.toThrow(new Error('useStream is compile-time'));
  });
});

describe('createStore / useStore (compile-target stubs)', () => {
  test('the handle carries the initial value and the setter is inert', () => {
    const store = createStore({ count: 3, label: 'Taps' });
    const [state, setState] = useStore(store);

    expect(store.initial).toEqual({ count: 3, label: 'Taps' });
    expect(state).toEqual({ count: 3, label: 'Taps' });
    // The stub never mutates: the generated Dart owns the state.
    setState({ count: 9 });
    expect(store.initial.count).toBe(3);
  });
});
