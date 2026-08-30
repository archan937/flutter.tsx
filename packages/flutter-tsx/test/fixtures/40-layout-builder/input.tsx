import { Column, LayoutBuilder, Text } from 'flutter-tsx';

export const Adaptive = () => (
  <Column>
    <LayoutBuilder
      builder={(context, constraints) =>
        constraints.maxWidth > 600 ? <Text>Wide</Text> : <Text>Narrow</Text>
      }
    />
  </Column>
);
