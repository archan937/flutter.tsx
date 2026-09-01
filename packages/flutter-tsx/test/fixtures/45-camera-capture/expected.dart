import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

class Capture extends StatefulWidget {
  const Capture({super.key});

  @override
  State<Capture> createState() => _CaptureState();
}

class _CaptureState extends State<Capture> {
  CameraController? _cam;
  String _savedTo = 'nothing yet';

  @override
  void initState() {
    super.initState();
    _initCam();
  }

  Future<void> _initCam() async {
    final cameras = await availableCameras();
    final controller = CameraController(cameras.first, ResolutionPreset.high);
    await controller.initialize();
    if (!mounted) {
      await controller.dispose();
      return;
    }
    setState(() {
      _cam = controller;
    });
  }

  @override
  void dispose() {
    _cam?.dispose();
    super.dispose();
  }

  Future<void> _take() async {
    final photo = await _cam?.takePicture();
    setState(() {
      _savedTo = photo?.path ?? 'cancelled';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(_savedTo),
        ElevatedButton(onPressed: _take, child: const Text('Take photo')),
      ],
    );
  }
}
