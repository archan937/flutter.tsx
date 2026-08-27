import {
  Column,
  createRouter,
  ElevatedButton,
  Text,
  useNavigation,
} from 'flutter-tsx';

export const HomePage = () => {
  const nav = useNavigation();

  return (
    <Column>
      <Text>Home</Text>
      <ElevatedButton onClick={() => nav.push('/detail')}>
        Open detail
      </ElevatedButton>
    </Column>
  );
};

export const DetailPage = () => {
  const nav = useNavigation();

  return (
    <Column>
      <Text>Detail</Text>
      <ElevatedButton onClick={() => nav.pop()}>Back</ElevatedButton>
    </Column>
  );
};

export const router = createRouter({
  '/': HomePage,
  '/detail': DetailPage,
});
