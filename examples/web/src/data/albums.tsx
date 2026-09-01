import type { Album } from '../models/album';

/**
 * The library this example ships with.
 *
 * A module-level constant becomes a top-level Dart constant, so the app has
 * something to render before it is connected to anything real. Swap it for an
 * `http.get` and `useAsync` gives you the loading and error states for free.
 */
export const ALBUMS: Album[] = [
  {
    id: 1,
    title: 'Kind of Blue',
    year: 1959,
    seconds: 2793,
    tags: ['jazz', 'modal'],
    artist: { name: 'Miles Davis', country: 'US' },
  },
  {
    id: 2,
    title: 'Selected Ambient Works',
    year: 1992,
    seconds: 4508,
    tags: ['ambient', 'techno'],
    artist: { name: 'Aphex Twin', country: 'GB' },
  },
  {
    id: 3,
    title: 'Homogenic',
    year: 1997,
    seconds: 2634,
    tags: ['electronic', 'pop'],
    artist: { name: 'Björk', country: 'IS' },
  },
];
