import { type FlutterFunctionComponent, jsx } from './jsx-runtime';
import type { FlutterElement } from './types';

export type { JSX } from './jsx-runtime';
export { Fragment } from './jsx-runtime';

export const jsxDEV = <TProps extends object>(
  type: FlutterFunctionComponent<TProps>,
  props: TProps,
  key?: string | number,
): FlutterElement => jsx(type, props, key);
