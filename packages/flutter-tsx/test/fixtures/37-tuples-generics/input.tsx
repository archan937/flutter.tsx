import { Column, Text } from 'flutter-tsx';

const firstOr = <T,>(values: T[], fallback: T): T => values[0] ?? fallback;

export const Span = ({
  range,
  names,
}: {
  range: [string, number];
  names: string[];
}) => (
  <Column>
    <Text>{range[0]}</Text>
    <Text>{range[1]}</Text>
    <Text>{firstOr(names, 'none')}</Text>
  </Column>
);
