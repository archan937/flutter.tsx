import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';

export const Stepper = () => {
  const [count, setCount] = useState(0);

  const bump = () => {
    if (count >= 3) {
      setCount(0);
    } else if (count === 2) {
      setCount(count + 2);
    } else {
      setCount(count + 1);
    }
  };

  return (
    <Column>
      <Text>Count: {count}</Text>
      <ElevatedButton onClick={bump}>Bump</ElevatedButton>
    </Column>
  );
};
