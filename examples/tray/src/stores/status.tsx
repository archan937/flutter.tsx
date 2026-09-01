import { createStore } from 'flutter-tsx';

/**
 * What the window and the tray icon agree on.
 *
 * The tray listener writes to it and the window reads it, so a click on the
 * icon shows up in the UI without either knowing about the other.
 */
export const statusStore = createStore({
  lastEvent: 'waiting for the tray',
  clicks: 0,
  paused: false,
});
