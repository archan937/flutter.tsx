import {
  Column,
  ElevatedButton,
  MediaQuery,
  Text,
  useBuildContext,
  useState,
} from 'flutter-tsx';

export const Measure = () => {
  const ctx = useBuildContext();
  const [width, setWidth] = useState(0.0);
  const [label, setLabel] = useState('unmeasured');

  const measure = () => {
    const shortest = MediaQuery.of(ctx);
    setWidth(MediaQuery.widthOf(ctx));
    setLabel(shortest.accessibleNavigation ? 'accessible' : 'standard');
  };

  return (
    <Column>
      <Text>
        {label} at {width}
      </Text>
      <ElevatedButton onClick={measure}>Measure</ElevatedButton>
    </Column>
  );
};
