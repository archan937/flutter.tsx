import { describe, expect, test } from 'bun:test';

import {
  createRouter,
  createStore,
  json,
  useAsync,
  useEffect,
  useNavigation,
  useState,
  useStore,
  useStream,
} from '@src/runtime/hooks';
import type { FlutterElement } from '@src/runtime/types';

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

describe('useNavigation / createRouter (compile-target stubs)', () => {
  test('the navigation handle is inert: the compiler rewrites each call', () => {
    const nav = useNavigation();

    // Every method is inert: the compiler rewrites the call sites, so these
    // must not throw and must not carry state.
    nav.push('/x');
    nav.replace('/y');
    nav.go('/z');
    nav.pop();
    nav.present({ widgetName: 'AlertDialog', props: {} });
    nav.presentSheet({ widgetName: 'Text', props: {} });
    expect(Object.keys(nav).sort()).toEqual([
      'go',
      'pop',
      'present',
      'presentSheet',
      'push',
      'replace',
    ]);
  });

  test('a route table keeps the paths it was given', () => {
    const Home = (): FlutterElement => ({ widgetName: 'Text', props: {} });
    const config = createRouter({ '/': Home });

    expect(Object.keys(config.routes)).toEqual(['/']);
  });
});

describe('json (compile-target stub)', () => {
  test('parses the body and hands back an unknown to cast', () => {
    const decoded = json('{"title":"Hello","id":7}');

    // `unknown` is the point: the cast is where the model is named, so the
    // value cannot be used untyped.
    expect(decoded).toEqual({ title: 'Hello', id: 7 });
  });
});
