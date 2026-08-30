import { Builder, Column, ElevatedButton, Text, useState } from 'flutter-tsx';

export const Panel = () => {
  const [open, setOpen] = useState(false);

  return (
    <Column>
      <Builder
        builder={() => (open ? <Text>Open</Text> : <Text>Closed</Text>)}
      />
      <ElevatedButton onClick={() => setOpen(!open)}>Toggle</ElevatedButton>
    </Column>
  );
};
