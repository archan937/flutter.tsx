import {
  AppBar,
  Center,
  Chip,
  Column,
  ElevatedButton,
  IconButton,
  Padding,
  Row,
  Scaffold,
  Text,
  useNavigation,
  useStore,
} from 'flutter-tsx';

import { ALBUMS } from '../data/albums';
import { duration, subtitle } from '../helpers/format';
import { libraryStore } from '../stores/library';

/** The album the library opened, and what the store says about it. */
export const AlbumPage = () => {
  const nav = useNavigation();
  const [state, setState] = useStore(libraryStore);

  const play = () => {
    setState({ plays: state.plays + 1 });
  };

  return (
    <Scaffold
      appBar={
        <AppBar
          title={<Text>Album</Text>}
          leading={
            <IconButton
              onClick={() => {
                nav.pop();
              }}
              icon={<Text>Back</Text>}
            />
          }
        />
      }
    >
      <Center>
        <Column mainAxisSize="min">
          {ALBUMS.filter((album) => album.id === state.playingId).map(
            (album) => (
              <Column mainAxisSize="min">
                <Text>{album.title}</Text>
                <Text>{album.artist.name}</Text>
                <Text>{subtitle(album.tags, album.year)}</Text>
                <Text>{duration(album.seconds)}</Text>
                <Row mainAxisAlignment="center">
                  {album.tags.map((tag) => (
                    <Padding padding={4}>
                      <Chip label={<Text>{tag}</Text>} />
                    </Padding>
                  ))}
                </Row>
              </Column>
            ),
          )}
          <Padding padding={16}>
            <ElevatedButton onClick={play}>
              Played {state.plays} times
            </ElevatedButton>
          </Padding>
        </Column>
      </Center>
    </Scaffold>
  );
};
