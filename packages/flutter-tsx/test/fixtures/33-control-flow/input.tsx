import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';

export const Auditor = ({ entries }: { entries: string[] }) => {
  const [status, setStatus] = useState('idle');
  const [seen, setSeen] = useState(0);

  const audit = () => {
    try {
      for (const entry of entries) {
        setStatus(entry.trim());
        setSeen(seen + 1);
      }
      switch (seen) {
        case 0:
          setStatus('empty');
          break;
        case 1:
        case 2:
          setStatus('sparse');
          break;
        default:
          setStatus('full');
      }
    } catch {
      setStatus('failed');
    }
  };

  return (
    <Column>
      <Text>{status}</Text>
      <ElevatedButton onClick={audit}>Audit</ElevatedButton>
    </Column>
  );
};
