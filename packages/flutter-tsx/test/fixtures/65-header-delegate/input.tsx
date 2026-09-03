import {
  Center,
  CustomScrollView,
  defineDelegate,
  SliverPersistentHeader,
  Text,
} from 'flutter-tsx';

const sticky = defineDelegate('SliverPersistentHeaderDelegate', {
  minExtent: () => 48,
  maxExtent: () => 96,
  shouldRebuild: () => false,
  build: (self, context, shrinkOffset) => (
    <Center>
      <Text>{`Scrolled ${shrinkOffset}`}</Text>
    </Center>
  ),
});

export const Feed = () => (
  <CustomScrollView
    slivers={[<SliverPersistentHeader delegate={sticky} pinned />]}
  />
);
