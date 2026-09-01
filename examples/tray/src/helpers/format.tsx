/** `84 ms` — a latency, or `1.8 s` once it stops being milliseconds. */
export const latency = (milliseconds: number): string => {
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)} ms`;
  }

  return `${(milliseconds / 1000).toFixed(1)} s`;
};

/** What the tray tooltip says, from what the checks are doing. */
export const tooltip = (failing: number): string => {
  if (failing === 0) {
    return 'All checks passing';
  }

  if (failing === 1) {
    return '1 check failing';
  }

  return `${failing} checks failing`;
};
