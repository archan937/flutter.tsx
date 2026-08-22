import { describe, expect, test } from 'bun:test';

import { coverageFailures, parseLcov } from '@scripts/lcov';

const sampleLcov = [
  'SF:lib/src/full.dart',
  'DA:1,3',
  'DA:2,1',
  'LF:2',
  'LH:2',
  'end_of_record',
  'SF:lib/src/partial.dart',
  'DA:1,1',
  'DA:2,0',
  'DA:3,0',
  'LF:3',
  'LH:1',
  'end_of_record',
].join('\n');

describe('parseLcov', () => {
  test('parses per-file line coverage with missed line numbers', () => {
    expect(parseLcov(sampleLcov)).toEqual([
      {
        path: 'lib/src/full.dart',
        linesHit: 2,
        linesFound: 2,
        missedLines: [],
      },
      {
        path: 'lib/src/partial.dart',
        linesHit: 1,
        linesFound: 3,
        missedLines: [2, 3],
      },
    ]);
  });

  test('parses empty content to an empty list', () => {
    expect(parseLcov('')).toEqual([]);
  });
});

describe('coverageFailures', () => {
  test('reports each file below 100% with its missed lines', () => {
    expect(coverageFailures(parseLcov(sampleLcov))).toEqual([
      'lib/src/partial.dart — 33.33% lines covered, missed: 2, 3',
    ]);
  });

  test('reports an empty report as a failure', () => {
    expect(coverageFailures([])).toEqual([
      'coverage report is empty — nothing was measured',
    ]);
  });
});
