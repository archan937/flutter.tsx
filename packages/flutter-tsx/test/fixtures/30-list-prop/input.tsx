import { Column, Text } from 'flutter-tsx';

export const TagList = ({ tags }: { tags: string[] }) => (
  <Column>
    {tags.map((tag) => (
      <Text>{tag}</Text>
    ))}
  </Column>
);
