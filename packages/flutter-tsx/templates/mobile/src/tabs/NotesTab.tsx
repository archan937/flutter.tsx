import {
  Column,
  Divider,
  Expanded,
  ListView,
  Padding,
  Text,
  TextField,
  useStore,
} from 'flutter-tsx';

import { NoteCard } from '../components/NoteCard';
import { NOTES } from '../data/notes';
import { notebookStore } from '../stores/notebook';

/** The notes, filtered by whatever is typed at the top. */
export const NotesTab = () => {
  const [state, setState] = useStore(notebookStore);

  const search = (value: string) => {
    setState({ query: value });
  };

  return (
    <Column>
      <Padding padding={12}>
        <TextField
          onChanged={search}
          decoration={{ hintText: 'Search notes' }}
        />
      </Padding>
      <Divider height={1} />
      <Expanded>
        <ListView padding={{ vertical: 8 }}>
          {NOTES.filter((note) => note.title.includes(state.query)).map(
            (note) => (
              <NoteCard note={note} />
            ),
          )}
        </ListView>
      </Expanded>
      <Padding padding={12}>
        <Text>{NOTES.length} notes on this device</Text>
      </Padding>
    </Column>
  );
};
