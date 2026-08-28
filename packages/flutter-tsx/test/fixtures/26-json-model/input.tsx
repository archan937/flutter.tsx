import {
  CircularProgressIndicator,
  Column,
  json,
  Text,
  useAsync,
} from 'flutter-tsx';
import { get } from 'plugin:http';

interface Author {
  name: string;
}

interface Album {
  id: number;
  title: string;
  tags: string[];
  author: Author;
  subtitle?: string;
}

export const AlbumDetail = async () => {
  const res = await useAsync(() => get('https://example.com/albums/1'), {
    loading: () => <CircularProgressIndicator />,
    error: (err) => <Text>{err}</Text>,
  });
  const album = json(res.body) as Album;

  return (
    <Column>
      <Text>{album.title}</Text>
      <Text>{album.author.name}</Text>
    </Column>
  );
};
