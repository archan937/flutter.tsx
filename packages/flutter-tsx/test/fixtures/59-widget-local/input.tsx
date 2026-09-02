import { Column, MediaQuery, Text, useBuildContext } from 'flutter-tsx';

export const Header = () => {
  const ctx = useBuildContext();
  const title = <Text>Flutter.tsx</Text>;
  const width = MediaQuery.widthOf(ctx);

  return (
    <Column>
      {title}
      <Text>Width: {width}</Text>
    </Column>
  );
};
