import { Padding, TextField, useStore } from 'flutter-tsx';

import { libraryStore } from '../stores/library';

/** Types into the store every component reads. */
export const SearchField = () => {
  const [, setState] = useStore(libraryStore);

  const search = (value: string) => {
    setState({ query: value });
  };

  return (
    <Padding padding={{ horizontal: 16, vertical: 8 }}>
      <TextField
        onChanged={search}
        decoration={{ hintText: 'Search albums' }}
      />
    </Padding>
  );
};
