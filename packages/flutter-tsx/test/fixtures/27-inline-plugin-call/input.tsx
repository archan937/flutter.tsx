import { Center, Text } from 'flutter-tsx';
import { launchUrl } from 'plugin:url_launcher';

export const InlineLink = () => (
  <Center>
    <Text onClick={() => launchUrl('https://flutter.dev')}>Open</Text>
  </Center>
);
