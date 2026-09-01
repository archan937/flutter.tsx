/**
 * What each conformance fixture is worth reading for.
 *
 * The fixtures are proof for the compiler, but a cookbook is read by someone
 * deciding whether to use this at all: a directory name like `28-multi-file`
 * and two unexplained code blocks tell them nothing. Every fixture is titled
 * as a task, grouped along the path a newcomer actually walks, and given the
 * one line that says what to look for in the Dart beside it.
 *
 * The catalogue and the suite are kept in step by a test: a fixture with no
 * entry, or an entry with no fixture, fails the build.
 */

export interface CatalogueEntry {
  /** What the reader is trying to do, not what the fixture is called. */
  title: string;
  /** One line: what this shows, and what the emitted Dart does about it. */
  blurb: string;
  category: string;
}

/** Groups in reading order: what to learn first comes first. */
export const CATEGORIES: readonly string[] = [
  'Start here',
  'State and effects',
  'Lists and data',
  'Loading data',
  'Native plugins',
  'Navigation and shell',
  'Project structure',
];

export const CATALOGUE: Readonly<Record<string, CatalogueEntry>> = {
  '02-hello-column': {
    title: 'Your first screen',
    blurb:
      'A component is a function returning JSX. Flutter widgets are the tags, their named parameters are the props, and the emitted Dart is a plain StatelessWidget.',
    category: 'Start here',
  },
  '03-styled-container': {
    title: 'Padding, colour and text style',
    blurb:
      'Values you would write as Dart objects are written as TSX props: `padding={16}` becomes `EdgeInsets.all(16)`, a hex string becomes a `Color`, and a style object becomes a `TextStyle`.',
    category: 'Start here',
  },
  '04-inline-handler': {
    title: 'Handling a callback prop',
    blurb:
      'An arrow function passed to a widget prop compiles to the Dart callback that prop expects, with the parameter names the SDK declares.',
    category: 'Start here',
  },
  '05-counter': {
    title: 'State with useState',
    blurb:
      'The hook you already know. The compiler sees the component holds state, emits a StatefulWidget, and wraps the assignment in `setState` so the rebuild happens.',
    category: 'Start here',
  },
  '08-composition': {
    title: 'Composing your own components',
    blurb:
      'A component used in the same file becomes its own widget class, constructed where you wrote the tag — the same composition you write in React.',
    category: 'Start here',
  },
  '09-typed-props': {
    title: 'Typing props with an interface',
    blurb:
      'A props interface becomes the widget constructor: each field a `required` named parameter and a `final` field, so a missing prop is a TypeScript error before it is a Dart one.',
    category: 'Start here',
  },
  '16-tap-target': {
    title: 'Making anything tappable',
    blurb:
      'Gesture props on any widget compile to the `GestureDetector` Flutter needs, without you nesting one by hand.',
    category: 'Start here',
  },

  '38-effect-cleanup': {
    title: 'Cleaning up when a screen goes away',
    blurb:
      'The function an effect returns is its unmount half: its statements become the widget’s `dispose`, ahead of any controller the effect was using.',
    category: 'State and effects',
  },
  '06-mount-effect': {
    title: 'Running code on mount',
    blurb:
      '`useEffect` with an empty dependency list is `initState` — the same idea, and the generated widget calls `super.initState()` for you.',
    category: 'State and effects',
  },
  '39-builder-callback': {
    title: 'A callback that returns a widget',
    blurb:
      'A builder prop takes an arrow function whose body is a widget — including a conditional one — and becomes an expression-bodied Dart closure.',
    category: 'State and effects',
  },
  '40-layout-builder': {
    title: 'Reading what a callback is handed',
    blurb:
      'A builder’s parameters are typed from the SDK, so `constraints.maxWidth` completes in the editor and compiles to the Dart member it names.',
    category: 'State and effects',
  },
  '29-branching-handler': {
    title: 'Branching inside a handler',
    blurb:
      'if / else if / else in an event handler compiles to the same branching in Dart, with every state assignment still wrapped in `setState`.',
    category: 'State and effects',
  },
  '33-control-flow': {
    title: 'Loops, switch and try/catch',
    blurb:
      'for-of, switch with fallthrough, and try/catch all compile to their Dart equivalents, so a handler can be as ordinary as any other function you write.',
    category: 'State and effects',
  },
  '19-store-counter': {
    title: 'State shared across screens',
    blurb:
      '`createStore` emits a `ChangeNotifier` and one instance of it; `useStore` reads it and notifies listeners on write. No provider wiring to set up.',
    category: 'State and effects',
  },

  '07-list-rendering': {
    title: 'Rendering a list',
    blurb:
      '`.map` over state spreads into the parent `children`, exactly where you wrote it, so a list is written the way it is in React.',
    category: 'Lists and data',
  },
  '30-list-prop': {
    title: 'Taking a list as a prop',
    blurb:
      'A `string[]` prop becomes a `List<String>` constructor parameter, and mapping over it spreads into the widget tree.',
    category: 'Lists and data',
  },
  '31-model-list': {
    title: 'A list of your own model',
    blurb:
      'An interface used as a prop type becomes a Dart class, so a list of models is typed on both sides.',
    category: 'Lists and data',
  },
  '34-list-pipeline': {
    title: 'filter, reduce and defaults',
    blurb:
      '`filter` becomes `where`, `reduce` becomes `fold` typed by its element, and `??` becomes Dart’s own — chained in one expression as you wrote it.',
    category: 'Lists and data',
  },
  '32-value-methods': {
    title: 'String and number methods',
    blurb:
      'The methods you reach for — `trim`, `toUpperCase`, `join`, `toFixed`, `includes` — map onto their Dart counterparts rather than being reimplemented.',
    category: 'Lists and data',
  },
  '41-model-helper': {
    title: 'A helper that returns a model',
    blurb:
      'A helper decodes and returns one of your interfaces, and reading a field off the call — `decode(body).title` — resolves to the Dart member it names.',
    category: 'Lists and data',
  },
  '35-helpers': {
    title: 'Helper functions beside a component',
    blurb:
      'A plain function in the file becomes a top-level Dart function with the same signature, so shared logic does not have to live in a widget.',
    category: 'Lists and data',
  },
  '36-enums': {
    title: 'Enums and string unions',
    blurb:
      'A TypeScript enum becomes a Dart enum, and a string union stays a `String` the type system still narrows — both usable as props.',
    category: 'Lists and data',
  },
  '37-tuples-generics': {
    title: 'Tuples and a generic helper',
    blurb:
      'A tuple type becomes a Dart record and a generic function keeps its type parameter, so neither has to be widened to `dynamic`.',
    category: 'Lists and data',
  },

  '25-http-get': {
    title: 'Fetching data over HTTP',
    blurb:
      '`await useAsync(...)` emits a `FutureBuilder`: the loading and error branches you pass become its waiting and error states, and the awaited value is the data in scope.',
    category: 'Loading data',
  },
  '26-json-model': {
    title: 'Decoding JSON into a model',
    blurb:
      '`json(body) as Album` generates the Dart data class and its `fromJson` factory — including the nested model, the list field and the optional one.',
    category: 'Loading data',
  },
  '17-async-token': {
    title: 'Awaiting a plugin call',
    blurb:
      'The same FutureBuilder, over a plugin instead of a request: anything returning a Future can be awaited this way.',
    category: 'Loading data',
  },
  '18-connectivity-stream': {
    title: 'Following a stream',
    blurb:
      '`useStream` is `useAsync` over a Dart `Stream`: it emits a `StreamBuilder`, and the awaited value is the latest event.',
    category: 'Loading data',
  },

  '01-camera-screen': {
    title: 'Taking a photo',
    blurb:
      '`useCamera` emits the whole controller lifecycle: `availableCameras`, `initialize`, a `mounted` check before setState, and `dispose` — the part that is easy to get wrong by hand.',
    category: 'Native plugins',
  },
  '45-camera-capture': {
    title: 'Using what a plugin hands back',
    blurb:
      'A call’s result is a value your code names and reads — `const photo = await cam.takePicture()` — and a read of something that may be null says so in the Dart.',
    category: 'Native plugins',
  },
  '46-camera-preview': {
    title: 'Rendering a plugin’s own widget',
    blurb:
      'A widget a package ships is a component like any other — `<CameraPreview controller={cam} />` — and because the handle is null until the hook has built it, TypeScript makes you guard, which is exactly the Dart that comes out.',
    category: 'Native plugins',
  },
  '47-guarded-handler': {
    title: 'Guarding before you use a handle',
    blurb:
      'The React shape — leave early when you are not ready yet — is the shape the Dart takes: `if (_cam == null) return;`, and every read after it drops the null checks it no longer needs.',
    category: 'Native plugins',
  },
  '48-number-types': {
    title: 'One number type, three Dart ones',
    blurb:
      'TypeScript has `number`; Dart has `int`, `double` and `num`, and will not pass one for another. The compiler widens at the boundary — `_width.toDouble()` — so ordinary arithmetic stays ordinary.',
    category: 'Lists and data',
  },
  '49-helper-body': {
    title: 'A helper with a body',
    blurb:
      'A function you write the ordinary way — locals, an early return, `Math.floor` — becomes the Dart function you would have written by hand, with `dart:math` imported for you.',
    category: 'Lists and data',
  },
  '50-module-data': {
    title: 'Data the module declares',
    blurb:
      'Seed data, lookup tables and labels live beside the code that reads them: an exported const becomes a top-level Dart constant, and `{ … }` where a model is expected constructs one.',
    category: 'Lists and data',
  },
  '51-plugin-values': {
    title: 'Building a value a plugin takes',
    blurb:
      'Where a package asks for one of its own classes, an object literal builds it — `webViewConfiguration: { enableJavaScript: true }` — and `new MediaType(…)` builds one by name.',
    category: 'Native plugins',
  },
  '52-mixed-label': {
    title: 'A label made of text and a value',
    blurb:
      '`Played {plays} times` is three children of one button, and it means one line — so it compiles to one interpolated `Text`, not to the first word with the rest dropped.',
    category: 'State and effects',
  },
  '10-camera-options': {
    title: 'Choosing a camera resolution',
    blurb:
      'Hook options are typed from the plugin’s own enums, so `resolution` completes in the editor and compiles to `ResolutionPreset.veryHigh`.',
    category: 'Native plugins',
  },
  '15-front-camera': {
    title: 'Selecting the front camera',
    blurb:
      'Passing `lens` filters the device list the plugin returns, rather than making you find the matching camera yourself.',
    category: 'Native plugins',
  },
  '11-preferences': {
    title: 'Storing a preference',
    blurb:
      'A service-style plugin becomes a hook returning the instance, so reading and writing preferences is one call.',
    category: 'Native plugins',
  },
  '12-secure-storage': {
    title: 'Storing a secret',
    blurb:
      'The same shape over the keychain and keystore, with the plugin’s own named arguments preserved.',
    category: 'Native plugins',
  },
  '13-open-link': {
    title: 'Opening a URL',
    blurb:
      'A plugin’s top-level functions are importable directly, and a URL string is wrapped in `Uri.parse` where Dart wants a `Uri`.',
    category: 'Native plugins',
  },
  '27-inline-plugin-call': {
    title: 'Calling a plugin from a tap',
    blurb:
      'A plugin call written inline in a handler compiles in place — no controller to thread through the widget.',
    category: 'Native plugins',
  },
  '43-tray-singleton': {
    title: 'A plugin that hands you its own instance',
    blurb:
      'Some packages expose a ready singleton — `final trayManager = ...`. The hook returns that one, so the call compiles to `trayManager.setToolTip(...)` with no controller to build or dispose.',
    category: 'Native plugins',
  },
  '44-tray-listener': {
    title: 'Answering a plugin’s events',
    blurb:
      'Write the callbacks you want on the hook and the widget becomes that plugin’s listener — the mixin, the `addListener(this)` on mount and the `removeListener(this)` on dispose are generated because you asked for the events.',
    category: 'Native plugins',
  },
  '14-app-info': {
    title: 'Reading app version info',
    blurb:
      'A plugin acquired through a static factory becomes a hook that awaits it, so the value is ready where you read it.',
    category: 'Native plugins',
  },

  '20-router': {
    title: 'Routing between screens',
    blurb:
      '`createRouter` emits a GoRouter with one route per entry, and `useNavigation` rewrites onto its BuildContext extensions — no navigator passed around.',
    category: 'Navigation and shell',
  },
  '21-modal': {
    title: 'Dialogs and bottom sheets',
    blurb:
      '`present` and `presentSheet` become `showDialog` and `showModalBottomSheet`, taking the component you wrote as their builder.',
    category: 'Navigation and shell',
  },
  '22-mount-dialog': {
    title: 'Showing a dialog on mount',
    blurb:
      'Presenting from an effect needs the frame to exist first, so the generated `initState` schedules it on the post-frame callback.',
    category: 'Navigation and shell',
  },
  '23-tabs': {
    title: 'A tabbed app shell',
    blurb:
      '`TabView` emits a `Scaffold` with a `BottomNavigationBar` over an `IndexedStack`, so every tab keeps its state while you switch.',
    category: 'Navigation and shell',
  },
  '24-animated': {
    title: 'Animating a change',
    blurb:
      '`<Animated type="fade">` becomes `AnimatedOpacity` driven by the value you pass — an implicit animation, no controller to manage.',
    category: 'Navigation and shell',
  },

  '42-project-layout': {
    title: 'A model and a store in their own files',
    blurb:
      'A shared store and the shapes your app passes around live where you would put them in any TypeScript project; each compiles to its own Dart file and the imports are rewritten to match.',
    category: 'Project structure',
  },
  '28-multi-file': {
    title: 'Importing a component from another file',
    blurb:
      'Each file compiles to its own Dart file, and the import between them is rewritten to match — so a project is laid out the way you would lay out any TypeScript one.',
    category: 'Project structure',
  },
};
