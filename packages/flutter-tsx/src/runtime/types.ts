export interface WidgetNode {
  readonly widgetName: string;
  readonly props: Record<string, unknown>;
}

export type FlutterElement = WidgetNode;

// Strings and numbers are valid children anywhere a widget fits: the
// compiler wraps them in Text(...) — the React-like DX contract.
export type FlutterChild =
  FlutterElement | string | number | null | undefined | false;

export type FlutterChildren = FlutterChild | FlutterChild[];

export type TextChildren =
  string | number | (string | number | null | undefined | false)[];

export interface FlutterComponent<TProps> {
  (props: TProps): FlutterElement;
  readonly widgetName: string;
}
