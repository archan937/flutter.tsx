// Framework shells: JSX elements the compiler expands into a Flutter widget
// tree rather than mapping one-to-one onto an SDK widget. They are declared
// here, not generated, because no SDK entity corresponds to them.
import type { IconName } from '../generated/constants';
import { declareWidget } from './component';
import type { FlutterChild, FlutterChildren, FlutterComponent } from './types';

/**
 * One bottom-tab destination. Named `TabItem` rather than `Tab` because
 * Flutter's own `Tab` widget (used with `TabBar`) must stay available.
 */
export interface TabItemProps {
  /** Text under the icon in the bar. */
  label: string;
  /**
   * An icon from the SDK's `Icons`, e.g. `"home"`. Typed as a union of every
   * name the installed SDK provides, so the IDE completes it and a typo is
   * caught where it is written.
   */
  icon: IconName;
  /** The page this tab shows. */
  children: FlutterChild;
}

export const TabItem: FlutterComponent<TabItemProps> =
  declareWidget<TabItemProps>('TabItem');

/**
 * A bottom-tab shell: every page stays alive in an `IndexedStack` while the
 * `BottomNavigationBar` switches between them.
 */
export interface TabViewProps {
  children: FlutterChildren;
}

export const TabView: FlutterComponent<TabViewProps> =
  declareWidget<TabViewProps>('TabView');

/**
 * An implicit animation. The driving value is part of the API on purpose: an
 * `<Animated>` with nothing changing would compile to a widget that never
 * animates.
 */
export type AnimatedProps =
  | {
      type: 'fade';
      /** Fades to transparent when false. */
      visible: boolean;
      /** Milliseconds the animation runs. */
      duration: number;
      children: FlutterChild;
    }
  | {
      type: 'scale';
      /** 1 is natural size. */
      scale: number;
      duration: number;
      children: FlutterChild;
    };

export const Animated: FlutterComponent<AnimatedProps> =
  declareWidget<AnimatedProps>('Animated');
