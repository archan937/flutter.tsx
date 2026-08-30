import { Column, json, Text } from 'flutter-tsx';

interface Track {
  title: string;
  year: number;
}

const decodeTrack = (body: string): Track => json(body) as Track;

const billing = (track: Track): string => track.title.toUpperCase();

export const Shelf = ({ payload }: { payload: string }) => (
  <Column>
    <Text>{billing(decodeTrack(payload))}</Text>
    <Text>{decodeTrack(payload).year}</Text>
    <Text>{(json(payload) as Track).title}</Text>
  </Column>
);
