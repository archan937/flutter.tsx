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
  /**
   * What may be written as a tag.
   *
   * A component that awaits — `const Page = async () => { const data = await
   * useAsync(…) }` — is a component like any other: the compiler turns it
   * into a FutureBuilder, so the tag `<Page />` is as valid as any other and
   * the types say so.
   */
  export type ElementType =
    | ((props: never) => FlutterElement)
    | ((props: never) => Promise<FlutterElement>);
  export interface ElementChildrenAttribute {
    children: unknown;
  }
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  // No lowercase intrinsic tags: every element is a typed component value.
  export type IntrinsicElements = Record<string, never>;
}
