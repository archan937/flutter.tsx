import { Column, Text } from 'flutter-tsx';
import { usePackageInfo } from 'plugin:package_info_plus';

export const AppInfo = () => {
  const info = usePackageInfo();

  if (!info) {
    return <Text>Loading…</Text>;
  }

  return (
    <Column>
      <Text>{info.appName}</Text>
      <Text>v{info.version}</Text>
    </Column>
  );
};
