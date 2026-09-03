import 'package:flutter/material.dart';

class _Layout extends MultiChildLayoutDelegate {
  @override
  void performLayout(Size size) {
    final label = layoutChild('label', BoxConstraints(maxWidth: size.width));
    positionChild('label', Offset(0, size.height - label.height));
  }

  @override
  bool shouldRelayout(MultiChildLayoutDelegate oldDelegate) => false;
}

final _Layout _layout = _Layout();

class Ribbon extends StatelessWidget {
  const Ribbon({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomMultiChildLayout(
      delegate: _layout,
      children: [LayoutId(id: 'label', child: const Text('New'))],
    );
  }
}
