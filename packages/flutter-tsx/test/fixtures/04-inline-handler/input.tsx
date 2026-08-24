import { Column, Switch, Text } from 'flutter-tsx';

export const Toggles = () => (
  <Column>
    <Text>Notifications</Text>
    <Switch value={true} onChanged={() => {}} />
    <Switch value={false} onChanged={(_enabled) => {}} />
  </Column>
);
