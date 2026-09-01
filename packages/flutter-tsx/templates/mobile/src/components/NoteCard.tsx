import {
  Card,
  Column,
  ListTile,
  Padding,
  Text,
  useNavigation,
} from 'flutter-tsx';

import { ago, preview, tagLine } from '../helpers/format';
import type { Note } from '../models/note';

/** One note in the list; tapping it opens the whole note in a sheet. */
export const NoteCard = ({ note }: { note: Note }) => {
  const nav = useNavigation();

  const open = () => {
    nav.presentSheet(
      <Padding padding={24}>
        <Column crossAxisAlignment="start" mainAxisSize="min">
          <Text>{note.title}</Text>
          <Padding padding={{ vertical: 12 }}>
            <Text>{note.body}</Text>
          </Padding>
          <Text>{tagLine(note.tags)}</Text>
        </Column>
      </Padding>,
    );
  };

  return (
    <Card margin={{ horizontal: 12, vertical: 6 }}>
      <ListTile
        onClick={open}
        title={<Text>{note.title}</Text>}
        subtitle={<Text>{preview(note.body)}</Text>}
        trailing={<Text>{ago(note.minutesAgo)}</Text>}
      />
    </Card>
  );
};
