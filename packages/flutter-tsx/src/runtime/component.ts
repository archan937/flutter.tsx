import type { FlutterComponent, WidgetNode } from '@src/runtime/types';

export const declareWidget = <TProps extends object>(
  widgetName: string,
): FlutterComponent<TProps> => {
  const component = (props: TProps): WidgetNode => ({
    widgetName,
    props: props as Record<string, unknown>,
  });
  return Object.assign(component, { widgetName });
};
