import { CircularProgressIndicator, Column, Text, useAsync } from 'flutter-tsx';
import { get } from 'plugin:http';

export const AlbumView = async () => {
  const res = await useAsync(() => get('https://example.com/album/1'), {
    loading: () => <CircularProgressIndicator />,
    error: (err) => <Text>{err}</Text>,
  });

  return (
    <Column>
      <Text>Status: {res.statusCode}</Text>
      <Text>{res.body}</Text>
    </Column>
  );
};
