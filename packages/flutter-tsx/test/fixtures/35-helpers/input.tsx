import { Column, Text } from 'flutter-tsx';

const initials = (value: string): string => value.trim().toUpperCase();

const active = (values: string[]): string[] =>
  values.filter((value) => value !== '');

export const Roster = ({ names }: { names: string[] }) => (
  <Column>
    {active(names).map((name) => (
      <Text>{initials(name)}</Text>
    ))}
  </Column>
);
