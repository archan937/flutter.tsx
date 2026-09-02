import { describe, expect, test } from 'bun:test';

import { dateFormDart } from '@src/derive/date-forms';

describe('dateFormDart', () => {
  test('a written date is the DateTime it names', () => {
    expect(dateFormDart('DateTime', '2026-01-31')).toBe(
      'DateTime(2026, 1, 31)',
    );
  });

  test('a written time is the TimeOfDay it names', () => {
    // Flutter's own constructor is const, so the value is too.
    expect(dateFormDart('TimeOfDay', '09:30')).toBe(
      'const TimeOfDay(hour: 9, minute: 30)',
    );
  });

  test('a value that is not the written form is not one', () => {
    expect(dateFormDart('DateTime', 'yesterday')).toBeNull();
    expect(dateFormDart('TimeOfDay', '9:30')).toBeNull();
    expect(dateFormDart('Color', '2026-01-31')).toBeNull();
  });
});
