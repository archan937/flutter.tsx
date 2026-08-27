import { Column, Container, Text, useState } from 'flutter-tsx';

export const TapTarget = () => {
  const [taps, setTaps] = useState(0);

  const bump = () => {
    setTaps(taps + 1);
  };

  return (
    <Column>
      <Container onClick={bump} onLongPress={bump} padding={16}>
        <Text>Tap me</Text>
      </Container>
      <Text>Taps: {taps}</Text>
    </Column>
  );
};
