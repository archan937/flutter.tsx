import { CircularProgressIndicator, Text, useStream } from 'flutter-tsx';
import { useConnectivity } from 'plugin:connectivity_plus';

export const ConnectionBanner = async () => {
  const connectivity = useConnectivity();
  const status = await useStream(() => connectivity.onConnectivityChanged, {
    loading: () => <CircularProgressIndicator />,
    error: (err) => <Text>{err}</Text>,
  });

  return <Text>Connections: {status.length}</Text>;
};
