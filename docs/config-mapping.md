# Config mapping — what fsx writes, and what it does not

A Flutter.tsx project is configured in two files, and everything native is produced from
them by the Flutter toolchain. This page says exactly which of your native project files
fsx owns — and, just as importantly, which it leaves to you today.

## What you configure

| File | Holds |
| --- | --- |
| `fsx.config.ts` | `name`, `bundleId`, and the default `target` (`web` · `ios` · `android` · `macos` · `windows` · `linux`) |
| `package.json` | npm dependencies, and the `"plugins"` map — pub packages and their version constraints |

Nothing else is a Flutter.tsx config surface. There is no theme file, no permissions file,
no locales file: the app is TSX, and everything else belongs to Flutter's own project.

## What fsx writes

| Target file | Written by | When |
| --- | --- | --- |
| `lib/**/*.dart` | `fsx dev`, `fsx build` | Every compile, from `src/**/*.tsx`; formatted with `dart format` |
| `lib/main.dart` | `fsx init`, then every compile | Only while it carries the generated marker — remove the marker and fsx never touches it again |
| `pubspec.yaml` dependencies | `fsx install` | From the `"plugins"` map, via `flutter pub add` / `pub remove` — fsx never edits the YAML itself |
| `pubspec.lock` | `flutter pub` | As a consequence of the above |
| `.fsx/types/*.d.ts` | `fsx install` | The `plugin:<name>` typings, generated from the resolved plugin version |
| `.fsx/api/*.json` | `fsx install` | The extracted plugin API the compiler compiles against |
| `.fsx/plugins.json` | `fsx install` | What was installed, so the next run can tell an unchanged plugin from a removed one |
| `web/`, `macos/`, `ios/`, `android/`, `windows/`, `linux/` | `fsx init`, `fsx build` | Created by `flutter create` for the platform being built, if the project has none |

`lib/` and `.fsx/` are generated and gitignored. A fresh clone needs `bun install && fsx
install`, and both are rebuilt.

## What fsx does not write yet

**Native permission and capability declarations.** Every plugin states what a host app
must declare — `NSCameraUsageDescription` on Apple platforms, `android.permission.CAMERA`
on Android, the matching entitlements on macOS — and Flutter.tsx already extracts that
from each plugin's own source, alongside the API it types. Nothing writes it into
`Info.plist`, `AndroidManifest.xml` or the entitlements files today: after adding a plugin
that needs a capability, add the declaration to the native file yourself, as you would in
a Flutter project.

The extracted requirements per plugin look like this, and are what a later release will
merge into the native files:

| Capability | iOS / macOS (`Info.plist`) | Android (`AndroidManifest.xml`) | macOS entitlement |
| --- | --- | --- | --- |
| camera | `NSCameraUsageDescription` | `android.permission.CAMERA` | `com.apple.security.device.camera` |
| microphone | `NSMicrophoneUsageDescription` | `android.permission.RECORD_AUDIO` | `com.apple.security.device.audio-input` |
| location | `NSLocationWhenInUseUsageDescription` | `android.permission.ACCESS_FINE_LOCATION` | `com.apple.security.personal-information.location` |
| photos | `NSPhotoLibraryUsageDescription` | `android.permission.READ_MEDIA_IMAGES` | `com.apple.security.files.user-selected.read-write` |
| network | — | `android.permission.INTERNET` | `com.apple.security.network.client` |

**Signing, icons, splash screens and store metadata.** These belong to the native projects
`flutter create` produced; edit them there.

**Theme.** An app's theme is Dart in the entry point. `fsx` generates a plain
`MaterialApp`; to theme it, take over `lib/main.dart` by removing the generated marker,
or wrap your root component in the widgets you want.

## Why it is drawn this way

The native projects are ordinary Flutter projects — nothing in them is Flutter.tsx's
invention, and any Flutter documentation about them applies unchanged. Flutter.tsx owns
the part it can own completely and provably: the Dart compiled from your TSX, and the
plugin surface that Dart compiles against.
