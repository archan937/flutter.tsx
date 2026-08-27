import { CircularProgressIndicator, Text, useAsync } from 'flutter-tsx';
import { useSecureStorage } from 'plugin:flutter_secure_storage';

export const TokenCheck = async () => {
  const storage = useSecureStorage();
  const hasToken = await useAsync(() => storage.containsKey({ key: 'token' }), {
    loading: () => <CircularProgressIndicator />,
    error: (err) => <Text>{err}</Text>,
  });

  return <Text>{hasToken ? 'Signed in' : 'Signed out'}</Text>;
};
