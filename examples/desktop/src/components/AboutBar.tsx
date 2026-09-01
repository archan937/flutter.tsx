import { Padding, Row, Text } from 'flutter-tsx';
import { usePackageInfo } from 'plugin:package_info_plus';

/**
 * The window's footer, filled in from the running build.
 *
 * `usePackageInfo` resolves after the first frame, so its handle is null
 * until it does — the guard below is what the types ask for, and it is the
 * Dart that comes out.
 */
export const AboutBar = () => {
  const info = usePackageInfo();

  if (!info) {
    return <Text>Reading build information…</Text>;
  }

  return (
    <Padding padding={{ horizontal: 16, vertical: 8 }}>
      <Row mainAxisAlignment="spaceBetween">
        <Text>{info.appName}</Text>
        <Text>
          v{info.version} ({info.buildNumber})
        </Text>
      </Row>
    </Padding>
  );
};
