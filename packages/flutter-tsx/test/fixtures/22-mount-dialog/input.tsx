import {
  AlertDialog,
  Column,
  Text,
  useEffect,
  useNavigation,
  useState,
} from 'flutter-tsx';

export const WelcomeDialog = () => (
  <AlertDialog title={<Text>Welcome!</Text>} />
);

export const Onboarding = () => {
  const nav = useNavigation();
  const [greeted, setGreeted] = useState(false);

  useEffect(() => {
    nav.present(<WelcomeDialog />);
    setGreeted(true);
  }, []);

  return (
    <Column>
      <Text>Onboarding</Text>
      {greeted && <Text>Greeted</Text>}
    </Column>
  );
};
