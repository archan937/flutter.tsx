import {
  Column,
  ElevatedButton,
  ListView,
  RichText,
  ScrollController,
  Text,
  TextEditingController,
  useBuildContext,
} from 'flutter-tsx';

export const Scroller = () => {
  const ctx = useBuildContext();
  const scroll = new ScrollController();
  const query = new TextEditingController();

  const top = () => {
    scroll.jumpTo(0);
  };

  return (
    <Column>
      <ElevatedButton onClick={top}>Back to top</ElevatedButton>
      <RichText
        text={query.buildTextSpan({ context: ctx, withComposing: false })}
      />
      <ListView controller={scroll}>
        <Text>One</Text>
        <Text>Two</Text>
      </ListView>
    </Column>
  );
};
