import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { launchUrl } from 'plugin:url_launcher';

export const OpenLink = () => {
  const [opened, setOpened] = useState(false);

  const open = async () => {
    await launchUrl('https://flutter.dev', { mode: 'externalApplication' });
    setOpened(true);
  };

  return (
    <Column>
      {opened && <Text>Opened!</Text>}
      <ElevatedButton onClick={open}>Open</ElevatedButton>
    </Column>
  );
};
