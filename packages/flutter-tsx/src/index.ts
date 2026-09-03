export const FLUTTER_TSX_VERSION = '1.0.0-alpha.0';

export * from './generated';
export type { AppConfig, AppTarget } from './runtime/config';
export type { DelegateName } from './runtime/delegate';
export { defineDelegate } from './runtime/delegate';
export type {
  AnimationHandle,
  AnimationOptions,
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
  json,
  useAnimation,
  useAsync,
  useBuildContext,
  useEffect,
  useNavigation,
  useState,
  useStore,
  useStream,
} from './runtime/hooks';
export { tween } from './runtime/hooks';
export type {
  AnimatedProps,
  TabItemProps,
  TabViewProps,
} from './runtime/shell';
export { Animated, TabItem, TabView } from './runtime/shell';
export type {
  FlutterChild,
  FlutterChildren,
  FlutterComponent,
  FlutterElement,
  TextChildren,
  WidgetNode,
} from './runtime/types';
export { FLUTTER_VERSION } from './sdk/version';
