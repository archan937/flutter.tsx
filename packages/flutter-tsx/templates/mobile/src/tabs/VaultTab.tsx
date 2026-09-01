import {
  CircularProgressIndicator,
  Column,
  ElevatedButton,
  Padding,
  Text,
  useAsync,
  useStore,
} from 'flutter-tsx';
import { useSecureStorage } from 'plugin:flutter_secure_storage';

import { notebookStore } from '../stores/notebook';

/**
 * The keychain, read and written.
 *
 * `useAsync` becomes a FutureBuilder: the loading and error branches are the
 * ones written here, and the body renders once the value arrives.
 */
export const VaultTab = async () => {
  const storage = useSecureStorage();
  const [state, setState] = useStore(notebookStore);

  const saved = await useAsync(
    () => storage.containsKey({ key: 'field-key' }),
    {
      loading: () => <CircularProgressIndicator />,
      error: (err) => <Text>{err}</Text>,
    },
  );

  const save = async () => {
    await storage.write({ key: 'field-key', value: state.lastPhotoPath });
    setState({ savedKey: 'field-key' });
  };

  return (
    <Padding padding={24}>
      <Column>
        <Text>
          {saved ? 'A key is stored on this device' : 'Nothing stored'}
        </Text>
        <Padding padding={{ vertical: 12 }}>
          <Text>{state.savedKey}</Text>
        </Padding>
        <ElevatedButton onClick={save}>
          Store the last photo path
        </ElevatedButton>
      </Column>
    </Padding>
  );
};
