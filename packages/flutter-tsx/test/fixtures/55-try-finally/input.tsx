import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useSharedPreferences } from 'plugin:shared_preferences';

export const SavedGreeting = () => {
  const prefs = useSharedPreferences();
  const [message, setMessage] = useState('nothing loaded');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      await prefs?.reload();
      setMessage(prefs?.getString('greeting') ?? 'nothing saved');
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Column>
      <Text>{message}</Text>
      <ElevatedButton onClick={load}>
        {busy ? 'Loading…' : 'Load'}
      </ElevatedButton>
    </Column>
  );
};
