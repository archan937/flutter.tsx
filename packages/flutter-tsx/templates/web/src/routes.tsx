import { createRouter } from 'flutter-tsx';

import { AlbumPage } from './pages/AlbumPage';
import { LibraryPage } from './pages/LibraryPage';

/**
 * The app's routes.
 *
 * A project that declares a router runs it: `fsx build` wires this into
 * `MaterialApp.router`, and `useNavigation().push('/album')` goes here.
 */
export const router = createRouter({
  '/': LibraryPage,
  '/album': AlbumPage,
});
