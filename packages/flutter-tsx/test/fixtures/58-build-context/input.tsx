import { Column, MediaQuery, Text, useBuildContext } from 'flutter-tsx';

export const ScreenSize = () => {
  const ctx = useBuildContext();
  const width = MediaQuery.widthOf(ctx);
  const dark = MediaQuery.platformBrightnessOf(ctx);

  return (
    <Column>
      <Text>Width: {width}</Text>
      <Text>Brightness: {dark}</Text>
    </Column>
  );
};
