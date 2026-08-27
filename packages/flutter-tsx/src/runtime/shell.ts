// Framework shells: JSX elements the compiler expands into a Flutter widget
// tree rather than mapping one-to-one onto an SDK widget. They are declared
// here, not generated, because no SDK entity corresponds to them.
import { declareWidget } from './component';
import type { FlutterChild, FlutterChildren, FlutterComponent } from './types';

/**
 * One bottom-tab destination. Named `TabItem` rather than `Tab` because
 * Flutter's own `Tab` widget (used with `TabBar`) must stay available.
 */
export interface TabItemProps {
  /** Text under the icon in the bar. */
  label: string;
  /** An icon name from the SDK's `Icons`, e.g. `"home"`. */
  icon: string;
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
