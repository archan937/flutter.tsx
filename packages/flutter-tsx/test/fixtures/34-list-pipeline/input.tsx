import { Column, Text } from 'flutter-tsx';

export const Totals = ({
  names,
  scores,
}: {
  names: string[];
  scores: number[];
}) => (
  <Column>
    <Text>{scores.reduce((sum, score) => sum + score, 0)}</Text>
    <Text>{names[0] ?? '-'}</Text>
    {names
      .filter((name) => name !== '')
      .map((name) => (
        <Text>{name}</Text>
      ))}
  </Column>
);
