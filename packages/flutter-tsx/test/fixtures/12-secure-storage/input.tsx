import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useSecureStorage } from 'plugin:flutter_secure_storage';

export const Vault = () => {
  const storage = useSecureStorage();
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await storage.write({ key: 'token', value: 'secret' });
    setSaved(true);
  };

  return (
    <Column>
      {saved && <Text>Saved!</Text>}
      <ElevatedButton onClick={save}>Save</ElevatedButton>
    </Column>
  );
};
