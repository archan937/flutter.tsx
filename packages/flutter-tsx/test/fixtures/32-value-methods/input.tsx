import { Column, Text } from 'flutter-tsx';

export const ValueMethods = ({
  name,
  tags,
  score,
}: {
  name: string;
  tags: string[];
  score: number;
}) => (
  <Column>
    <Text>{name.trim().toUpperCase()}</Text>
    <Text>{tags.join(', ')}</Text>
    <Text>{score.toFixed(1)}</Text>
    <Text>{name.includes('a') ? 'match' : 'no match'}</Text>
  </Column>
);
