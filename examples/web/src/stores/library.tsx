import { createStore } from 'flutter-tsx';

/**
 * What the whole app agrees on: the search box, and which album is open.
 *
 * A store is a ChangeNotifier and one instance, so any component can read it
 * with `useStore` and every reader rebuilds when it changes.
 */
export const libraryStore = createStore({
  query: '',
  playingId: 0,
  plays: 0,
});
