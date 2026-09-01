import {
  AppBar,
  Column,
  Divider,
  Expanded,
  ListView,
  Scaffold,
  Text,
  useStore,
} from 'flutter-tsx';

import { AlbumCard } from '../components/AlbumCard';
import { SearchField } from '../components/SearchField';
import { ALBUMS } from '../data/albums';
import { libraryStore } from '../stores/library';

/** The list every other page comes back to. */
export const LibraryPage = () => {
  const [state] = useStore(libraryStore);

  return (
    <Scaffold appBar={<AppBar title={<Text>Library</Text>} />}>
      <Column>
        <SearchField />
        <Divider height={1} />
        <Expanded>
          <ListView padding={{ vertical: 8 }}>
            {ALBUMS.filter((album) => album.title.includes(state.query)).map(
              (album) => (
                <AlbumCard album={album} />
              ),
            )}
          </ListView>
        </Expanded>
      </Column>
    </Scaffold>
  );
};
