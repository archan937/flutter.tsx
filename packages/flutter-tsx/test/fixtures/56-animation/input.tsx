import {
  Column,
  ElevatedButton,
  FadeTransition,
  Text,
  useAnimation,
} from 'flutter-tsx';

export const Pulse = () => {
  const fade = useAnimation({ duration: 600 });

  const show = () => {
    fade.forward();
  };

  const hide = () => {
    fade.reverse();
  };

  return (
    <Column>
      <FadeTransition opacity={fade}>
        <Text>Now you see me</Text>
      </FadeTransition>
      <ElevatedButton onClick={show}>Show</ElevatedButton>
      <ElevatedButton onClick={hide}>Hide</ElevatedButton>
    </Column>
  );
};
