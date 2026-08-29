import { Column, Text } from 'flutter-tsx';

enum BadgeStatus {
  Active = 'active',
  Paused = 'paused',
}

export const Badge = ({
  status,
  tone,
}: {
  status: BadgeStatus;
  tone: 'warn' | 'ok';
}) => (
  <Column>
    <Text>{status === BadgeStatus.Active ? 'running' : 'stopped'}</Text>
    <Text>{tone}</Text>
  </Column>
);
