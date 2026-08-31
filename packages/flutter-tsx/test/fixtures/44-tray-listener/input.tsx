import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useTrayManager } from 'plugin:tray_manager';

export const TrayMenu = () => {
  const [label, setLabel] = useState('none');

  const tray = useTrayManager({
    onTrayIconMouseDown: () => {
      setLabel('icon');
    },
    onTrayMenuItemClick: (item) => {
      setLabel(item.key ?? 'none');
    },
  });

  const setup = async () => {
    await tray.setToolTip('Flutter.tsx');
  };

  return (
    <Column>
      <Text>{label}</Text>
      <ElevatedButton onClick={setup}>Set tooltip</ElevatedButton>
    </Column>
  );
};
