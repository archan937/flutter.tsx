import {
  AppBar,
  Column,
  Divider,
  ElevatedButton,
  Expanded,
  ListView,
  Padding,
  Row,
  Scaffold,
  Text,
  useEffect,
  useStore,
} from 'flutter-tsx';
import { useTrayManager } from 'plugin:tray_manager';

import { CheckRow } from './components/CheckRow';
import { ConnectionBadge } from './components/ConnectionBadge';
import { CHECKS } from './data/checks';
import { tooltip } from './helpers/format';
import { statusStore } from './stores/status';

/**
 * A menu-bar companion.
 *
 * `useTrayManager` registers this widget as the plugin's listener while it is
 * mounted and removes it again on dispose — writing a callback is all it
 * takes to receive the event.
 */
export const App = () => {
  const [state, setState] = useStore(statusStore);

  const tray = useTrayManager({
    onTrayIconMouseDown: () => {
      setState({ lastEvent: 'icon clicked', clicks: state.clicks + 1 });
    },
    onTrayIconRightMouseDown: () => {
      setState({ lastEvent: 'right click' });
    },
    onTrayMenuItemClick: (item) => {
      setState({ lastEvent: item.key ?? 'menu' });
    },
  });

  useEffect(() => {
    void tray.setToolTip(tooltip(1));
  }, []);

  const pause = async () => {
    setState({ paused: !state.paused });
    await tray.setToolTip(state.paused ? tooltip(1) : 'Paused');
  };

  return (
    <Scaffold appBar={<AppBar title={<Text>Status</Text>} />}>
      <Column crossAxisAlignment="stretch">
        <Padding padding={12}>
          <Row mainAxisAlignment="spaceBetween">
            <Text>{state.lastEvent}</Text>
            <ConnectionBadge />
          </Row>
        </Padding>
        <Divider height={1} />
        <Expanded>
          <ListView>
            {CHECKS.map((check) => (
              <CheckRow check={check} />
            ))}
          </ListView>
        </Expanded>
        <Divider height={1} />
        <Padding padding={12}>
          <Row mainAxisAlignment="spaceBetween">
            <Text>{state.clicks} icon clicks</Text>
            <ElevatedButton onClick={pause}>
              {state.paused ? 'Resume' : 'Pause'}
            </ElevatedButton>
          </Row>
        </Padding>
      </Column>
    </Scaffold>
  );
};
