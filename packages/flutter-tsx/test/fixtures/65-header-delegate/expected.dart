import 'package:flutter/material.dart';

class _Sticky extends SliverPersistentHeaderDelegate {
  @override
  double get minExtent => 48;

  @override
  double get maxExtent => 96;

  @override
  bool shouldRebuild(SliverPersistentHeaderDelegate oldDelegate) => false;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) => Center(child: Text('Scrolled $shrinkOffset'));
}

final _Sticky _sticky = _Sticky();

class Feed extends StatelessWidget {
  const Feed({super.key});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [SliverPersistentHeader(delegate: _sticky, pinned: true)],
    );
  }
}
