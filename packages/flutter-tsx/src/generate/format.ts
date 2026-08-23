import prettier from 'prettier';

const PRETTIER_OPTIONS: prettier.Options = {
  parser: 'typescript',
  singleQuote: true,
  trailingComma: 'all',
};

export const formatTs = (source: string): Promise<string> =>
  prettier.format(source, PRETTIER_OPTIONS);
