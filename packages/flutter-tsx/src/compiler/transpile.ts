export interface TranspileInput {
  source: string;
  filePath: string;
}

export const transpileComponent = (_input: TranspileInput): string => {
  throw new Error(
    'flutter-tsx compiler: not implemented yet — the golden fixtures stay ' +
      'red until roadmap steps 11–21 earn them.',
  );
};
