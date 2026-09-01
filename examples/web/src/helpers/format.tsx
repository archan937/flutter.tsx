/** `3:07` — a duration a listener recognises, from a count of seconds. */
export const duration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);

  if (rest < 10) {
    return `${minutes}:0${rest}`;
  }

  return `${minutes}:${rest}`;
};

/** `Ada Lovelace` → `AL`, for an artist with no picture of their own. */
export const initials = (name: string): string =>
  name
    .split(' ')
    .map((part) => part.substring(0, 1))
    .join('')
    .toUpperCase();

/** `rock, synth · 1994` — the line under a title. */
export const subtitle = (tags: string[], year: number): string =>
  `${tags.join(', ')} · ${year}`;
