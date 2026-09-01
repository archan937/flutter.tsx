import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

class Shoot extends StatefulWidget {
  const Shoot({super.key});

  @override
  State<Shoot> createState() => _ShootState();
}

class _ShootState extends State<Shoot> {
  CameraController? _cam;
  String _message = 'nothing yet';

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

  Future<void> _shoot() async {
    try {
      final photo = await _cam?.takePicture();
      setState(() {
        _message = photo?.path ?? 'cancelled';
      });
    } catch (error) {
      if (error is CameraException) {
        setState(() {
          _message = error.code;
        });
      } else {
        setState(() {
          _message = error.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(_message),
        ElevatedButton(onPressed: _shoot, child: const Text('Take photo')),
      ],
    );
  }
}
