import { Column, ElevatedButton, Text, useEffect, useState } from 'flutter-tsx';

export const Status = () => {
  const [online, setOnline] = useState(false);
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    setOnline(true);
  }, []);

  return (
    <Column>
      {online ? <Text>Online</Text> : <Text>Offline</Text>}
      <Text>Checks: {checks}</Text>
      <ElevatedButton onClick={() => setChecks(checks + 1)}>
        Check
      </ElevatedButton>
    </Column>
  );
};
