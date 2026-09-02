import 'package:flutter/material.dart';

class ScreenSize extends StatelessWidget {
  const ScreenSize({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.widthOf(context);
    final dark = MediaQuery.platformBrightnessOf(context);
    return Column(children: [Text('Width: $width'), Text('Brightness: $dark')]);
  }
}
