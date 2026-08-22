export interface LcovFile {
  path: string;
  linesHit: number;
  linesFound: number;
  missedLines: number[];
}

export const parseLcov = (content: string): LcovFile[] => {
  const files: LcovFile[] = [];
  let current: LcovFile | null = null;

  for (const line of content.split('\n')) {
    if (line.startsWith('SF:')) {
      current = {
        path: line.slice(3),
        linesHit: 0,
        linesFound: 0,
        missedLines: [],
      };
      files.push(current);
      continue;
    }
    if (current === null || !line.startsWith('DA:')) {
      continue;
    }
    const [lineNumber, hitCount] = line.slice(3).split(',');
    current.linesFound += 1;
    if (hitCount === '0') {
      current.missedLines.push(Number(lineNumber));
    } else {
      current.linesHit += 1;
    }
  }

  return files;
};

export const coverageFailures = (files: LcovFile[]): string[] => {
  if (files.length === 0) {
    return ['coverage report is empty — nothing was measured'];
  }
  return files
    .filter((file) => file.linesHit < file.linesFound)
    .map((file) => {
      const percent = ((file.linesHit / file.linesFound) * 100).toFixed(2);
      const missed = file.missedLines.join(', ');
      return `${file.path} — ${percent}% lines covered, missed: ${missed}`;
    });
};
