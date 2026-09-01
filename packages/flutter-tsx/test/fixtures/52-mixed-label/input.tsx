import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';

export const PlayCount = () => {
  const [plays, setPlays] = useState(0);

  const play = () => {
    setPlays(plays + 1);
  };

  return (
    <Column>
      <Text>Now playing</Text>
      <ElevatedButton onClick={play}>Played {plays} times</ElevatedButton>
    </Column>
  );
};
