import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { launchUrl } from 'plugin:url_launcher';

export const OpenInApp = () => {
  const [opened, setOpened] = useState('nothing yet');

  const open = async () => {
    await launchUrl('https://flutter.dev', {
      mode: 'inAppWebView',
      webViewConfiguration: { enableJavaScript: true, enableDomStorage: false },
    });
    setOpened('flutter.dev');
  };

  return (
    <Column>
      <Text>{opened}</Text>
      <ElevatedButton onClick={open}>Open in app</ElevatedButton>
    </Column>
  );
};
