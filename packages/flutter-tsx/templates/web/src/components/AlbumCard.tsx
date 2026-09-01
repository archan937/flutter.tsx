import {
  Card,
  Column,
  ListTile,
  Padding,
  Text,
  useNavigation,
  useStore,
} from 'flutter-tsx';

import { duration, initials, subtitle } from '../helpers/format';
import type { Album } from '../models/album';
import { libraryStore } from '../stores/library';

/** One album in the list: tap it to open its page. */
export const AlbumCard = ({ album }: { album: Album }) => {
  const nav = useNavigation();
  const [state, setState] = useStore(libraryStore);

  const open = () => {
    setState({ playingId: album.id });
    nav.push('/album');
  };

  return (
    <Card margin={{ horizontal: 12, vertical: 6 }}>
      <ListTile
        onClick={open}
        selected={state.playingId === album.id}
        title={<Text>{album.title}</Text>}
        subtitle={<Text>{subtitle(album.tags, album.year)}</Text>}
        leading={<Text>{initials(album.artist.name)}</Text>}
        trailing={
          <Padding padding={8}>
            <Column mainAxisSize="min">
              <Text>{duration(album.seconds)}</Text>
            </Column>
          </Padding>
        }
      />
    </Card>
  );
};
