import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useSharedPreferences } from 'plugin:shared_preferences';

export const Profile = () => {
  const prefs = useSharedPreferences();
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await prefs.setString('name', 'Paul');
    setSaved(true);
  };

  return (
    <Column>
      {saved && <Text>Saved!</Text>}
      <ElevatedButton onClick={save}>Save</ElevatedButton>
    </Column>
  );
};
