import { Center, defineDelegate, Router, Text } from 'flutter-tsx';

const routes = defineDelegate('RouterDelegate', {
  build: () => (
    <Center>
      <Text>Home</Text>
    </Center>
  ),
  popRoute: async () => false,
  setNewRoutePath: async () => {},
});

export const AppRouter = () => <Router routerDelegate={routes} />;
