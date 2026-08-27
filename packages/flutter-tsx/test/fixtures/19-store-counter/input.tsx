import {
  Column,
  createStore,
  ElevatedButton,
  Text,
  useStore,
} from 'flutter-tsx';

const counterStore = createStore({ count: 0, label: 'Taps' });

export const StoreCounter = () => {
  const [state, setState] = useStore(counterStore);

  const increment = () => {
    setState({ count: state.count + 1 });
  };

  return (
    <Column>
      <Text>
        {state.label}: {state.count}
      </Text>
      <ElevatedButton onClick={increment}>Increment</ElevatedButton>
    </Column>
  );
};
