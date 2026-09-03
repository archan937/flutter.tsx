import {
  CustomMultiChildLayout,
  defineDelegate,
  LayoutId,
  Offset,
  Text,
} from 'flutter-tsx';

const layout = defineDelegate('MultiChildLayoutDelegate', {
  performLayout: (self, size) => {
    const label = self.layoutChild('label', { maxWidth: size.width });
    self.positionChild('label', new Offset(0, size.height - label.height));
  },
  shouldRelayout: () => false,
});

export const Ribbon = () => (
  <CustomMultiChildLayout delegate={layout}>
    <LayoutId id="label">
      <Text>New</Text>
    </LayoutId>
  </CustomMultiChildLayout>
);
