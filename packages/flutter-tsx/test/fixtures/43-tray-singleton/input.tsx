import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useTrayManager } from 'plugin:tray_manager';

export const TrayTooltip = () => {
  const tray = useTrayManager();
  const [shown, setShown] = useState(false);

  const show = async () => {
    await tray.setToolTip('Flutter.tsx');
    setShown(true);
  };

  return (
    <Column>
      {shown && <Text>Tray ready</Text>}
      <ElevatedButton onClick={show}>Set tooltip</ElevatedButton>
    </Column>
  );
};
