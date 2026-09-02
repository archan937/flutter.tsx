/**
 * Dates and times as a developer writes them.
 *
 * Dart builds a `DateTime` and a `TimeOfDay` by constructor, which no TSX
 * literal can be. Both have one written form everyone already knows — the ISO
 * date and the 24-hour clock — so that is the form a prop takes, and this is
 * the only place either is defined: the typings, the example synthesizer and
 * the lowering all read it from here.
 */
export interface DateForm {
  /** The Dart type the prop declares. */
  dartType: string;
  /** The TypeScript arm added to the type's value union. */
  tsArm: string;
  /** What the written form has to look like. */
  pattern: RegExp;
  /** How the form reads, for a diagnostic. */
  shape: string;
  /** An example value, for the reference. */
  example: string;
}

export const DATE_TIME_TYPE = 'DateTime';
export const TIME_OF_DAY_TYPE = 'TimeOfDay';

export const DATE_FORMS: ReadonlyMap<string, DateForm> = new Map([
  [
    DATE_TIME_TYPE,
    {
      dartType: DATE_TIME_TYPE,
      tsArm: '`${number}-${number}-${number}`',
      pattern: /^(\d{4})-(\d{2})-(\d{2})$/,
      shape: 'a date, written YYYY-MM-DD',
      example: '2026-01-31',
    },
  ],
  [
    TIME_OF_DAY_TYPE,
    {
      dartType: TIME_OF_DAY_TYPE,
      tsArm: '`${number}:${number}`',
      pattern: /^(\d{2}):(\d{2})$/,
      shape: 'a time of day, written HH:MM',
      example: '09:30',
    },
  ],
]);

/** The Dart the written form becomes, or null when it is not that form. */
export const dateFormDart = (typeName: string, text: string): string | null => {
  const form = DATE_FORMS.get(typeName);
  if (form === undefined) {
    return null;
  }
  const parts = form.pattern.exec(text);
  if (parts === null) {
    return null;
  }
  const [, first = '', second = '', third] = parts;
  if (typeName === TIME_OF_DAY_TYPE) {
    return `const TimeOfDay(hour: ${Number(first)}, minute: ${Number(second)})`;
  }
  return `DateTime(${Number(first)}, ${Number(second)}, ${Number(third)})`;
};
