export const FLUTTER_TSX_VERSION = '1.0.0-alpha.0';

export * from './generated';
export type {
  AsyncOptions,
  EffectCleanup,
  Navigation,
  RouterConfig,
  RouteTarget,
  StateSetter,
  Store,
  StorePatch,
} from './runtime/hooks';
export {
  createRouter,
  createStore,
  useAsync,
  useEffect,
  useNavigation,
  useState,
  useStore,
  useStream,
} from './runtime/hooks';
export type { TabItemProps, TabViewProps } from './runtime/shell';
export { TabItem, TabView } from './runtime/shell';
export type {
  FlutterChild,
  FlutterChildren,
  FlutterComponent,
  FlutterElement,
  TextChildren,
  WidgetNode,
} from './runtime/types';
export { FLUTTER_VERSION } from './sdk/version';
