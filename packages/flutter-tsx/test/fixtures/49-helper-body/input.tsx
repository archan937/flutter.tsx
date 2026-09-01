import { Column, Text } from 'flutter-tsx';

/** `3:07` — a duration a listener recognises, from a count of seconds. */
export const duration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);

  if (rest < 10) {
    return `${minutes}:0${rest}`;
  }

  return `${minutes}:${rest}`;
};

export const loudness = (peak: number): string =>
  `${Math.round(Math.min(peak, 1) * 100)}%`;

export const Meter = ({ seconds, peak }: { seconds: number; peak: number }) => (
  <Column>
    <Text>{duration(seconds)}</Text>
    <Text>{loudness(peak)}</Text>
  </Column>
);
