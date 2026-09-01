import { createStore } from 'flutter-tsx';

/** What every tab agrees on: the filter, the photo, and what was saved. */
export const notebookStore = createStore({
  query: '',
  lastPhotoPath: '',
  savedKey: '',
  captures: 0,
});
