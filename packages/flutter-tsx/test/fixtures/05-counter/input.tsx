import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';

export const Counter = () => {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
  };

  return (
    <Column mainAxisAlignment="center">
      <Text>Count: {count}</Text>
      <ElevatedButton onClick={increment}>Increment</ElevatedButton>
    </Column>
  );
};
