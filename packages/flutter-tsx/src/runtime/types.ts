export interface WidgetNode {
  readonly widgetName: string;
  readonly props: Record<string, unknown>;
}

export type FlutterElement = WidgetNode;

// Strings and numbers are valid children anywhere a widget fits (the
// compiler wraps them in Text(...)), and arrays nest recursively so
// list-rendering expressions drop straight into a children list — the
// React-like DX contract.
export type FlutterChild =
  | FlutterElement
  | string
  | number
  | null
  | undefined
  | false
  | readonly FlutterChild[];

export type FlutterChildren = FlutterChild | FlutterChild[];

export type TextChildren =
  string | number | (string | number | null | undefined | false)[];

export interface FlutterComponent<TProps> {
  (props: TProps): FlutterElement;
  readonly widgetName: string;
}
