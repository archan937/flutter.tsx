import { Animated, Column, ElevatedButton, Text, useState } from 'flutter-tsx';

export const Fader = () => {
  const [shown, setShown] = useState(true);

  const toggle = () => {
    setShown(!shown);
  };

  return (
    <Column>
      <Animated type="fade" visible={shown} duration={300}>
        <Text>Fades</Text>
      </Animated>
      <ElevatedButton onClick={toggle}>Toggle</ElevatedButton>
    </Column>
  );
};
