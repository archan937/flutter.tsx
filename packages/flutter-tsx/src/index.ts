export const FLUTTER_TSX_VERSION = '1.0.0-alpha.0';

export * from './generated';
export type { EffectCleanup, StateSetter } from './runtime/hooks';
export { useEffect, useState } from './runtime/hooks';
export type {
  FlutterChild,
  FlutterChildren,
  FlutterComponent,
  FlutterElement,
  TextChildren,
  WidgetNode,
} from './runtime/types';
export { FLUTTER_VERSION } from './sdk/version';
