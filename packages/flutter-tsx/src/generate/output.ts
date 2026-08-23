import prettier from 'prettier';

import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';
import { emitConstantsFile, emitWidgetsFile } from '@src/generate/emit';

export interface GeneratedFile {
  relativePath: string;
  content: string;
}

const PRETTIER_OPTIONS: prettier.Options = {
  parser: 'typescript',
  singleQuote: true,
  trailingComma: 'all',
};

const format = (source: string): Promise<string> =>
  prettier.format(source, PRETTIER_OPTIONS);

export const generateAll = async (): Promise<GeneratedFile[]> => {
  const snapshot = await loadApiSnapshot();
  const slots = deriveSlots(snapshot);

  return [
    {
      relativePath: 'src/generated/widgets.ts',
      content: await format(emitWidgetsFile(snapshot, slots)),
    },
    {
      relativePath: 'src/generated/constants.ts',
      content: await format(emitConstantsFile(snapshot)),
    },
  ];
};
