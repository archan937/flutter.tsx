/** `4h 20m ago` — a duration a human reads, from a count of minutes. */
export const ago = (minutes: number): string => {
  if (minutes < 60) {
    return `${Math.round(minutes)}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);

  return `${hours}h ${rest}m ago`;
};

/** `12.4k` — a rate that stays three characters wide as it grows. */
export const rate = (perMinute: number): string => {
  if (perMinute < 1000) {
    return `${Math.round(perMinute)}/min`;
  }

  return `${(perMinute / 1000).toFixed(1)}k/min`;
};

/** `0.4%` — an error rate, rounded the way a dashboard shows it. */
export const percent = (fraction: number): string =>
  `${(fraction * 100).toFixed(1)}%`;

/** The one-word health of a service, from the numbers behind it. */
export const health = (errorRate: number): string => {
  if (errorRate > 0.05) {
    return 'failing';
  }

  if (errorRate > 0.01) {
    return 'degraded';
  }

  return 'healthy';
};
