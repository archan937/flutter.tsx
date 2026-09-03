// Every conformance fixture, and what a real Flutter app needs to host it.
// One app hosts them all: `flutter create`, `pub add`, `flutter test` and
// `flutter build web` each run ONCE for the whole suite instead of per
// fixture, which is the difference between a ten-minute gate and a
// one-minute gate. Per-fixture compilability is still proven exactly — the
// goldens are byte-equal and the 543-widget sweep analyzes every probe on
// its own.
export interface FixtureApp {
  /** Fixture directory under packages/flutter-tsx/test/fixtures. */
  id: string;
  /** Component the fixture exports. */
  component: string;
  /** File the generated Dart is written to, under lib/. */
  dartFile: string;
  /** Pub packages the generated Dart imports. */
  deps: string[];
  /**
   * Extra pub packages a behavior test needs (platform fakes), kept apart
   * from what the generated code itself requires.
   */
  testDeps?: string[];
  /** True when fixtures/behavior/<id>.dart drives it at runtime. */
  behavior?: boolean;
  /**
   * Dart files the fixture emits beside `expected.dart`, for an example
   * spanning several files — a model or a store in its own file.
   */
  siblings?: string[];
}

export const FIXTURE_APPS: FixtureApp[] = [
  {
    id: '01-camera-screen',
    component: 'CameraScreen',
    dartFile: 'camera_screen.dart',
    deps: ['camera'],
  },
  {
    id: '02-hello-column',
    component: 'HelloScreen',
    dartFile: 'hello_screen.dart',
    deps: [],
  },
  {
    id: '03-styled-container',
    component: 'StyledCard',
    dartFile: 'styled_card.dart',
    deps: [],
  },
  {
    id: '04-inline-handler',
    component: 'Toggles',
    dartFile: 'toggles.dart',
    deps: [],
  },
  {
    id: '05-counter',
    component: 'Counter',
    dartFile: 'counter.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '06-mount-effect',
    component: 'Status',
    dartFile: 'status.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '07-list-rendering',
    component: 'Groceries',
    dartFile: 'groceries.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '08-composition',
    component: 'Welcome',
    dartFile: 'welcome.dart',
    deps: [],
  },
  {
    id: '09-typed-props',
    component: 'TaskBoard',
    dartFile: 'task_board.dart',
    deps: [],
  },
  {
    id: '10-camera-options',
    component: 'HiResCamera',
    dartFile: 'hi_res_camera.dart',
    deps: ['camera'],
  },
  {
    id: '11-preferences',
    component: 'Profile',
    dartFile: 'profile.dart',
    deps: ['shared_preferences'],
    behavior: true,
  },
  {
    id: '12-secure-storage',
    component: 'Vault',
    dartFile: 'vault.dart',
    deps: ['flutter_secure_storage'],
    behavior: true,
  },
  {
    id: '13-open-link',
    component: 'OpenLink',
    dartFile: 'open_link.dart',
    deps: ['url_launcher'],
    testDeps: ['url_launcher_platform_interface', 'plugin_platform_interface'],
    behavior: true,
  },
  {
    id: '14-app-info',
    component: 'AppInfo',
    dartFile: 'app_info.dart',
    deps: ['package_info_plus'],
    behavior: true,
  },
  {
    id: '15-front-camera',
    component: 'Selfie',
    dartFile: 'selfie.dart',
    deps: ['camera'],
  },
  {
    id: '16-tap-target',
    component: 'TapTarget',
    dartFile: 'tap_target.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '17-async-token',
    component: 'TokenCheck',
    dartFile: 'token_check.dart',
    deps: ['flutter_secure_storage'],
    behavior: true,
  },
  {
    id: '18-connectivity-stream',
    component: 'ConnectionBanner',
    dartFile: 'connection_banner.dart',
    deps: ['connectivity_plus'],
    testDeps: [
      'connectivity_plus_platform_interface',
      'plugin_platform_interface',
    ],
    behavior: true,
  },
  {
    id: '19-store-counter',
    component: 'StoreCounter',
    dartFile: 'store_counter.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '20-router',
    component: 'HomePage',
    dartFile: 'router_pages.dart',
    deps: ['go_router'],
    behavior: true,
  },
  {
    id: '21-modal',
    component: 'DeleteButton',
    dartFile: 'delete_button.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '22-mount-dialog',
    component: 'Onboarding',
    dartFile: 'onboarding.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '23-tabs',
    component: 'Shell',
    dartFile: 'tab_shell.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '24-animated',
    component: 'Fader',
    dartFile: 'fader.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '25-http-get',
    component: 'AlbumView',
    dartFile: 'album_view.dart',
    deps: ['http'],
    behavior: true,
  },
  {
    id: '26-json-model',
    component: 'AlbumDetail',
    dartFile: 'album_json.dart',
    deps: ['http'],
    behavior: true,
  },
  {
    id: '27-inline-plugin-call',
    component: 'InlineLink',
    dartFile: 'inline_link.dart',
    deps: ['url_launcher'],
  },
  {
    id: '29-branching-handler',
    component: 'Stepper',
    dartFile: 'stepper.dart',
    deps: [],
  },
  {
    id: '30-list-prop',
    component: 'TagList',
    dartFile: 'tag_list.dart',
    deps: [],
  },
  {
    id: '31-model-list',
    component: 'JobBoard',
    dartFile: 'job_board.dart',
    deps: [],
  },
  {
    id: '32-value-methods',
    component: 'ValueMethods',
    dartFile: 'value_methods.dart',
    deps: [],
  },
  {
    id: '33-control-flow',
    component: 'Auditor',
    dartFile: 'auditor.dart',
    deps: [],
  },
  {
    id: '34-list-pipeline',
    component: 'Totals',
    dartFile: 'totals.dart',
    deps: [],
  },
  {
    id: '35-helpers',
    component: 'Roster',
    dartFile: 'roster.dart',
    deps: [],
  },
  {
    id: '36-enums',
    component: 'Badge',
    dartFile: 'badge.dart',
    deps: [],
  },
  {
    id: '37-tuples-generics',
    component: 'Span',
    dartFile: 'span.dart',
    deps: [],
  },
  {
    id: '38-effect-cleanup',
    component: 'Browser',
    dartFile: 'browser.dart',
    deps: ['url_launcher'],
  },
  {
    id: '39-builder-callback',
    component: 'Panel',
    dartFile: 'panel.dart',
    deps: [],
  },
  {
    id: '40-layout-builder',
    component: 'Adaptive',
    dartFile: 'adaptive.dart',
    deps: [],
  },
  {
    id: '41-model-helper',
    component: 'Shelf',
    dartFile: 'shelf.dart',
    deps: [],
  },
  {
    id: '28-multi-file',
    component: 'Directory',
    dartFile: 'directory.dart',
    deps: [],
    siblings: ['user_card.dart'],
  },
  {
    id: '42-project-layout',
    component: 'NowPlaying',
    dartFile: 'now_playing.dart',
    deps: [],
    siblings: ['song.dart', 'playlist.dart'],
  },
  {
    id: '43-tray-singleton',
    component: 'TrayTooltip',
    dartFile: 'tray_tooltip.dart',
    deps: ['tray_manager'],
  },
  {
    id: '44-tray-listener',
    component: 'TrayMenu',
    dartFile: 'tray_menu.dart',
    deps: ['tray_manager'],
  },
  {
    id: '45-camera-capture',
    component: 'Capture',
    dartFile: 'capture.dart',
    deps: ['camera'],
  },
  {
    id: '46-camera-preview',
    component: 'Viewfinder',
    dartFile: 'viewfinder.dart',
    deps: ['camera'],
  },
  {
    id: '62-controller-methods',
    component: 'Scroller',
    dartFile: 'scroller.dart',
    deps: [],
  },
  {
    id: '61-static-in-handler',
    component: 'Measure',
    dartFile: 'measure.dart',
    deps: [],
  },
  {
    id: '63-layout-delegate',
    component: 'Ribbon',
    dartFile: 'ribbon.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '64-table-source',
    component: 'Backlog',
    dartFile: 'backlog.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '65-header-delegate',
    component: 'Feed',
    dartFile: 'feed.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '66-router-delegate',
    component: 'AppRouter',
    dartFile: 'app_router.dart',
    deps: [],
    behavior: true,
  },
  {
    id: '60-button-style',
    component: 'Styled',
    dartFile: 'styled.dart',
    deps: [],
  },
  {
    id: '59-widget-local',
    component: 'Header',
    dartFile: 'header.dart',
    deps: [],
  },
  {
    id: '58-build-context',
    component: 'ScreenSize',
    dartFile: 'screen_size.dart',
    deps: [],
  },
  {
    id: '57-tween',
    component: 'Drifter',
    dartFile: 'drifter.dart',
    deps: [],
  },
  {
    id: '56-animation',
    component: 'Pulse',
    dartFile: 'pulse.dart',
    deps: [],
  },
  {
    id: '55-try-finally',
    component: 'SavedGreeting',
    dartFile: 'saved_greeting.dart',
    deps: ['shared_preferences'],
  },
  {
    id: '54-typed-error',
    component: 'Shoot',
    dartFile: 'shoot.dart',
    deps: ['camera'],
  },
  {
    id: '53-owned-controller',
    component: 'SearchBox',
    dartFile: 'search_box.dart',
    deps: [],
  },
  {
    id: '52-mixed-label',
    component: 'PlayCount',
    dartFile: 'play_count.dart',
    deps: [],
  },
  {
    id: '51-plugin-values',
    component: 'OpenInApp',
    dartFile: 'open_in_app.dart',
    deps: ['url_launcher'],
  },
  {
    id: '50-module-data',
    component: 'NoteList',
    dartFile: 'note_list.dart',
    deps: [],
  },
  {
    id: '49-helper-body',
    component: 'Meter',
    dartFile: 'meter.dart',
    deps: [],
  },
  {
    id: '48-number-types',
    component: 'SegmentRow',
    dartFile: 'segment_row.dart',
    deps: [],
  },
  {
    id: '47-guarded-handler',
    component: 'GuardedCapture',
    dartFile: 'guarded_capture.dart',
    deps: ['camera'],
  },
];
