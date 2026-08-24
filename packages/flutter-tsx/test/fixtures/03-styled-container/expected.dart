import 'package:flutter/material.dart';

class StyledCard extends StatelessWidget {
  const StyledCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      color: const Color(0xFF7B1FA2),
      alignment: AlignmentGeometry.center,
      child: const Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Styled',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text('with value props', style: TextStyle(color: Colors.white70)),
        ],
      ),
    );
  }
}
