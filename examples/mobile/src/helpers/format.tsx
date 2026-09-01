/** `2h 40m ago` — how long ago something happened, from minutes. */
export const ago = (minutes: number): string => {
  if (minutes < 60) {
    return `${Math.round(minutes)}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ${Math.round(minutes % 60)}m ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
};

/** `site · urgent` — the tags of a note on one line. */
export const tagLine = (tags: string[]): string => tags.join(' · ');

/** The first line of a note's body, for the list. */
export const preview = (body: string): string => {
  if (body.length <= 48) {
    return body;
  }

  return `${body.substring(0, 45)}…`;
};
