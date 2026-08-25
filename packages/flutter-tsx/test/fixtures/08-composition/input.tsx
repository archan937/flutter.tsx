import { Center, Column, Text } from 'flutter-tsx';

const Greeting = ({ name }: { name: string }) => <Text>Hello, {name}!</Text>;

export const Welcome = () => (
  <Center>
    <Column>
      <Greeting name="Paul" />
      <Greeting name="World" />
    </Column>
  </Center>
);
