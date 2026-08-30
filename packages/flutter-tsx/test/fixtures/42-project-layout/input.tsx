import { Column, ElevatedButton, Text, useStore } from 'flutter-tsx';

import { playlistStore } from './playlist';
import type { Song } from './song';

export const NowPlaying = ({ song }: { song: Song }) => {
  const [state, setState] = useStore(playlistStore);

  const play = () => {
    setState({ plays: state.plays + 1 });
  };

  return (
    <Column>
      <Text>{song.title}</Text>
      <Text>Played: {state.plays}</Text>
      <ElevatedButton onClick={play}>Play</ElevatedButton>
    </Column>
  );
};
