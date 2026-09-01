import {
  Column,
  ElevatedButton,
  Expanded,
  ListView,
  ScrollController,
  Text,
  TextEditingController,
  TextField,
  useState,
} from 'flutter-tsx';

export const SearchBox = () => {
  const query = new TextEditingController();
  const scroll = new ScrollController();
  const [submitted, setSubmitted] = useState('nothing yet');

  const submit = () => {
    setSubmitted('searched');
  };

  return (
    <Column>
      <TextField controller={query} />
      <ElevatedButton onClick={submit}>Search</ElevatedButton>
      <Text>{submitted}</Text>
      <Expanded>
        <ListView controller={scroll}>
          <Text>Result</Text>
        </ListView>
      </Expanded>
    </Column>
  );
};
