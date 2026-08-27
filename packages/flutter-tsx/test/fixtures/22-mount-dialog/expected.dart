import 'package:flutter/material.dart';

class WelcomeDialog extends StatelessWidget {
  const WelcomeDialog({super.key});

  @override
  Widget build(BuildContext context) {
    return const AlertDialog(title: Text('Welcome!'));
  }
}

class Onboarding extends StatefulWidget {
  const Onboarding({super.key});

  @override
  State<Onboarding> createState() => _OnboardingState();
}

class _OnboardingState extends State<Onboarding> {
  bool _greeted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      showDialog(context: context, builder: (context) => const WelcomeDialog());
      setState(() {
        _greeted = true;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [const Text('Onboarding'), if (_greeted) const Text('Greeted')],
    );
  }
}
