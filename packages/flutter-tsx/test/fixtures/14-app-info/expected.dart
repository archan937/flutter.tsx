import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

class AppInfo extends StatefulWidget {
  const AppInfo({super.key});

  @override
  State<AppInfo> createState() => _AppInfoState();
}

class _AppInfoState extends State<AppInfo> {
  PackageInfo? _info;

  @override
  void initState() {
    super.initState();
    _initInfo();
  }

  Future<void> _initInfo() async {
    final instance = await PackageInfo.fromPlatform();
    if (!mounted) {
      return;
    }
    setState(() {
      _info = instance;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [Text(_info?.appName ?? ''), Text('v${_info?.version ?? ''}')],
    );
  }
}
