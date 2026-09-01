import { CircularProgressIndicator, Text, useStream } from 'flutter-tsx';
import { useConnectivity } from 'plugin:connectivity_plus';

/**
 * The machine's connectivity, live.
 *
 * `useStream` becomes a StreamBuilder: the loading and error branches are the
 * ones you write here, and the body is what renders once a value arrives.
 */
export const ConnectionBadge = async () => {
  const connectivity = useConnectivity();
  const status = await useStream(() => connectivity.onConnectivityChanged, {
    loading: () => <CircularProgressIndicator />,
    error: (err) => <Text>Offline ({err})</Text>,
  });

  return <Text>{status.length} connection(s)</Text>;
};
