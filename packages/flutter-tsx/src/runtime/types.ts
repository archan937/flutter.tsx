export interface WidgetNode {
  readonly widgetName: string;
  readonly props: Record<string, unknown>;
}

export type FlutterElement = WidgetNode;

export type FlutterChild = FlutterElement | null | undefined | false;

export type FlutterChildren = FlutterChild | FlutterChild[];

export type TextChildren =
  string | number | (string | number | null | undefined | false)[];

export interface FlutterComponent<TProps> {
  (props: TProps): FlutterElement;
  readonly widgetName: string;
}
