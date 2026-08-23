import type { FlutterElement } from './types';

export type FlutterFunctionComponent<TProps> = (
  props: TProps,
) => FlutterElement;

export const FRAGMENT_WIDGET_NAME = '#fragment';

export const Fragment: FlutterFunctionComponent<{ children?: unknown }> = (
  props,
) => ({
  widgetName: FRAGMENT_WIDGET_NAME,
  props,
});

export const jsx = <TProps extends object>(
  type: FlutterFunctionComponent<TProps>,
  props: TProps,
  key?: string | number,
): FlutterElement => type(key === undefined ? props : { ...props, key });

export const jsxs = jsx;

// The JSX namespace is how TypeScript types TSX expressions; a namespace
// declaration is the only syntax TypeScript accepts for it.
export namespace JSX {
  export type Element = FlutterElement;
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  // No lowercase intrinsic tags: every element is a typed component value.
  export type IntrinsicElements = Record<string, never>;
}
