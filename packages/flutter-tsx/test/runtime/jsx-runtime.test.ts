import { describe, expect, test } from 'bun:test';

import { declareWidget } from '@src/runtime/component';
import { jsxDEV } from '@src/runtime/jsx-dev-runtime';
import { Fragment, jsx, jsxs } from '@src/runtime/jsx-runtime';

const Center = declareWidget<{ widthFactor?: number; children?: unknown }>(
  'Center',
);

describe('jsx', () => {
  test('builds a widget node from a component and props', () => {
    expect(jsx(Center, { widthFactor: 2 })).toEqual({
      widgetName: 'Center',
      props: { widthFactor: 2 },
    });
  });

  test('merges the JSX key into the props', () => {
    expect(jsx(Center, { widthFactor: 2 }, 'row-1')).toEqual({
      widgetName: 'Center',
      props: { widthFactor: 2, key: 'row-1' },
    });
  });

  test('jsxs is the same factory (children arrive via props)', () => {
    const children = [jsx(Center, {}), jsx(Center, {})];

    expect(jsxs(Center, { children })).toEqual({
      widgetName: 'Center',
      props: { children },
    });
  });

  test('user-defined function components are invoked', () => {
    const Screen = (props: { title: string }): ReturnType<typeof Center> =>
      jsx(Center, { widthFactor: props.title.length });

    expect(jsx(Screen, { title: 'hi' })).toEqual({
      widgetName: 'Center',
      props: { widthFactor: 2 },
    });
  });
});

describe('jsxDEV', () => {
  test('the dev runtime builds identical nodes', () => {
    expect(jsxDEV(Center, { widthFactor: 2 }, 'row-1')).toEqual({
      widgetName: 'Center',
      props: { widthFactor: 2, key: 'row-1' },
    });
  });
});

describe('Fragment', () => {
  test('collects children under a fragment node', () => {
    const children = [jsx(Center, {})];

    expect(jsx(Fragment, { children })).toEqual({
      widgetName: '#fragment',
      props: { children },
    });
  });
});
