import type { Check } from '../models/check';

/** The endpoints this companion watches while it sits in the menu bar. */
export const CHECKS: Check[] = [
  {
    id: 1,
    label: 'flutter.dev',
    url: 'https://flutter.dev',
    lastMs: 84,
    ok: true,
  },
  { id: 2, label: 'pub.dev', url: 'https://pub.dev', lastMs: 132, ok: true },
  {
    id: 3,
    label: 'api.internal',
    url: 'https://dart.dev',
    lastMs: 1840,
    ok: false,
  },
];
