import type { Note } from '../models/note';

/** The notes this app starts with, so there is something to see on launch. */
export const NOTES: Note[] = [
  {
    id: 1,
    title: 'Bridge inspection',
    body: 'Handrail is loose on the north side; photographed the bolt.',
    minutesAgo: 42,
    tags: ['site', 'urgent'],
  },
  {
    id: 2,
    title: 'Soil samples',
    body: 'Three samples taken along the east verge, bagged and labelled.',
    minutesAgo: 320,
    tags: ['lab'],
  },
  {
    id: 3,
    title: 'Access notes',
    body: 'Gate code changed; the key safe is behind the substation.',
    minutesAgo: 2880,
    tags: ['site'],
  },
];
