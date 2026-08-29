import { Column, Text } from 'flutter-tsx';

export const UserCard = ({ name, admin }: { name: string; admin: boolean }) => (
  <Column>
    <Text>{name}</Text>
    <Text>{admin ? 'admin' : 'member'}</Text>
  </Column>
);
