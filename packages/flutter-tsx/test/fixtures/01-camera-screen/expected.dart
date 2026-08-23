import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> {
  CameraController? _cam;
  bool _taken = false;

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

  Future<void> _takePhoto() async {
    await _cam?.takePicture();
    setState(() {
      _taken = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_taken) const Text('Photo saved!'),
        ElevatedButton(onPressed: _takePhoto, child: const Text('Take Photo')),
      ],
    );
  }
}
