import { Column, Text } from 'flutter-tsx';

interface Keeper {
  name: string;
}

interface Note {
  id: number;
  title: string;
  tags: string[];
  keeper: Keeper;
}

export const NOTES: Note[] = [
  {
    id: 1,
    title: 'Pinned',
    tags: ['inbox'],
    keeper: { name: 'Ada' },
  },
  {
    id: 2,
    title: 'Later',
    tags: ['someday', 'maybe'],
    keeper: { name: 'Grace' },
  },
];

export const EMPTY_LABEL = 'Nothing here yet';

export const NoteList = () => (
  <Column>
    <Text>{EMPTY_LABEL}</Text>
    {NOTES.map((note) => (
      <Text>
        {note.title} by {note.keeper.name}
      </Text>
    ))}
  </Column>
);
