import {
  AlertDialog,
  Column,
  ElevatedButton,
  Text,
  useNavigation,
  useState,
} from 'flutter-tsx';

export const ConfirmDialog = () => (
  <AlertDialog title={<Text>Delete this?</Text>} />
);

export const SheetBody = () => <Text>Options</Text>;

export const DeleteButton = () => {
  const nav = useNavigation();
  const [asked, setAsked] = useState(false);

  const confirm = () => {
    nav.present(<ConfirmDialog />);
    setAsked(true);
  };

  return (
    <Column>
      {asked && <Text>Asked</Text>}
      <ElevatedButton onClick={confirm}>Delete</ElevatedButton>
      <ElevatedButton onClick={() => nav.presentSheet(<SheetBody />)}>
        More
      </ElevatedButton>
    </Column>
  );
};
