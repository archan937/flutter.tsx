import { createStore } from 'flutter-tsx';

/**
 * What the window agrees on: which service is open, what is filtered out,
 * and which section the sidebar is showing.
 */
export const consoleStore = createStore({
  selectedId: 1,
  query: '',
  section: 0,
  refreshes: 0,
});
