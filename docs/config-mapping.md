# Config mapping — fsx config → native config, per platform

How each **flutter-tsx config key** fans out to the **native files** every platform expects. Cross-platform values are declared **once** (in `config/app.ts` or a semantic surface) and fsx writes the per-platform native config for you; the irreducibly OS-specific bits live in `config/platforms/<os>.ts`.

Legend: ✅ written by fsx · — N/A by platform design (the OS has no such concept) · 🔑 credential file in gitignored `signing/<os>/`.

---

## Permissions — `config/permissions.ts` (+ inferred from hooks)

Capabilities are **inferred** from the hooks you use (`useCamera()` → `camera`); `config/permissions.ts` only customizes the usage string. One capability → the right native key on every platform that gates it.

| fsx capability | iOS (`Info.plist`)                    | Android (`AndroidManifest.xml`) | macOS (`Info.plist` + `*.entitlements`)                            | Windows | Linux |
| -------------- | ------------------------------------- | ------------------------------- | ------------------------------------------------------------------ | ------- | ----- |
| `camera`       | `NSCameraUsageDescription`            | `android.permission.CAMERA`     | `NSCameraUsageDescription` + `com.apple.security.device.camera`    | —       | —     |
| `microphone`   | `NSMicrophoneUsageDescription`        | `RECORD_AUDIO`                  | usage string + `com.apple.security.device.audio-input`             | —       | —     |
| `location`     | `NSLocationWhenInUseUsageDescription` | `ACCESS_FINE_LOCATION`          | usage string + `com.apple.security.personal-information.location`  | —       | —     |
| `photos`       | `NSPhotoLibrary*UsageDescription`     | `READ_EXTERNAL_STORAGE`         | usage string + `com.apple.security.files.user-selected.read-write` | —       | —     |
| `contacts`     | `NSContactsUsageDescription`          | `READ_CONTACTS`                 | `com.apple.security.personal-information.addressbook`              | —       | —     |
| `calendar`     | `NSCalendarsUsageDescription`         | `READ/WRITE_CALENDAR`           | `com.apple.security.personal-information.calendars`                | —       | —     |
| `bluetooth`    | `NSBluetoothAlwaysUsageDescription`   | `BLUETOOTH*`                    | `com.apple.security.device.bluetooth`                              | —       | —     |

**Windows/Linux are "—" by design:** a desktop binary isn't gated behind a capability manifest the way mobile/sandboxed-macOS apps are, so there is nothing to write — not a gap.

Sources: [Apple — Information Property List](https://developer.apple.com/documentation/bundleresources/information_property_list) · [Apple — App Sandbox entitlements](https://developer.apple.com/documentation/security/app_sandbox) · [Android — `<uses-permission>`](https://developer.android.com/guide/topics/manifest/uses-permission-element)

---

## Deep / universal links — `config/links.ts`

`{ scheme, domains }` → custom-scheme handling + verified-domain (universal/app) links.

| field     | iOS                                                         | Android                                          | macOS                                    | Windows                                            | Linux                                            |
| --------- | ----------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `scheme`  | `CFBundleURLTypes` (`Info.plist`)                           | `<intent-filter>` scheme (`AndroidManifest.xml`) | `CFBundleURLTypes` (`Info.plist`)        | `signing/`-free `<scheme>.reg` (HKCU URL Protocol) | `<scheme>.desktop` (`x-scheme-handler/<scheme>`) |
| `domains` | `com.apple.developer.associated-domains` (`*.entitlements`) | `autoVerify` `<intent-filter>` (`https`)         | `com.apple.developer.associated-domains` | —                                                  | —                                                |

Windows `.reg` / Linux `.desktop` registration is partly an install-time step; fsx emits the artifact, the installer/packager applies it.

Sources: [Apple — Universal Links](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app) · [Android — App Links](https://developer.android.com/training/app-links)

---

## Theme · env · i18n (fully cross-platform — same Dart everywhere)

| fsx config        | Output                                                  | Platforms |
| ----------------- | ------------------------------------------------------- | --------- |
| `config/theme.ts` | Material 3 `ThemeData` injected into your `MaterialApp` | all 6     |
| `config/env.ts`   | `--dart-define=KEY=VALUE` build flags                   | all 6     |
| `locales/*.json`  | generated `l10n.dart` (`const t = useTranslations()`)   | all 6     |

These are Dart-level — no native files involved, so they're identical on every target.

---

## System tray / menubar — `config/tray.ts` (desktop)

Presence of `config/tray.ts` turns a desktop app into a tray/menubar app. fsx
generates an async `main.dart` bootstrap and adds the native deps.

| fsx config       | Output                                                                                                                                                                   | Platforms               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `config/tray.ts` | `window_manager` + `tray_manager` deps; `main.dart` tray bootstrap (icon from `icons/tray.png`, falling back to `icons/icon.png`; context menu; Show/Hide/Quit listener) | macOS · Windows · Linux |

```ts
import type { TrayConfig } from 'flutter-tsx/config';
export default {
  tooltip: 'My App',
  menu: [
    { label: 'Show', action: 'show' },
    { label: 'Quit', action: 'quit' },
  ],
} satisfies TrayConfig;
```

---

## Signing & release — `config/platforms/<os>.ts` + gitignored `signing/<os>/`

The genuinely platform-bound surface. Typed config is committed; the credential **files** live in gitignored `signing/<os>/` and are referenced by path. Passwords come from environment variables (named in the config), never source.

| platform | `config/platforms/<os>.ts`                           | fsx action                                               | credential 🔑            |
| -------- | ---------------------------------------------------- | -------------------------------------------------------- | ------------------------ |
| android  | `signing: { keystore, keyAlias, storePasswordEnv? }` | writes `android/key.properties` (pre-build)              | `signing/android/*.jks`  |
| ios      | `teamId?`, `firebase?`                               | copies FCM plist; team id for Xcode signing              | profile/cert in Xcode    |
| macos    | `signing: { identity, notarize? }`                   | `codesign` + `xcrun notarytool` + `stapler` (post-build) | Developer ID in keychain |
| windows  | `signing: { certificate, passwordEnv? }`             | `signtool sign` (Authenticode, post-build)               | `signing/windows/*.pfx`  |
| linux    | `signing: { gpgKeyEnv? }`                            | optional GPG artifact signing                            | GPG key                  |

FCM/push files: `config/platforms/android.ts → firebase: 'signing/android/google-services.json'`, `ios.ts → firebase: '…/GoogleService-Info.plist'`.

Sources: [Flutter — Android deployment](https://docs.flutter.dev/deployment/android) · [Apple — Notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) · [Microsoft — SignTool](https://learn.microsoft.com/windows/win32/seccrypto/signtool)

---

## Key-placement rule (where does a key go?)

1. **Same concept across targets** — even if the natives name it differently (iOS `isSomething` vs Android `something`) — collapses to **one semantic key** in `config/app.ts` / a semantic surface. fsx writes the differently-named native keys for you.
2. **Genuinely unique to one platform** → `config/platforms/<os>.ts`.
3. Tie-breaker = ease-of-use: if one key can serve multiple targets, unify it. `config/app.ts` wins; the platform file fills only the OS-specific leftovers.
