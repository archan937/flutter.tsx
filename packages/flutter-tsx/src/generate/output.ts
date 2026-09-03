import prettier from 'prettier';

import { loadApiSnapshot } from '../api/load';
import { deriveSlots } from '../derive/slots';
import { emitDelegatesFile } from './delegates';
import {
  declaredSurface,
  emitConstantsFile,
  emitGeneratedIndex,
  emitWidgetsFile,
} from './emit';

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
  // What the widgets module declares is what the delegates module may name.
  const surface = declaredSurface(snapshot);

  return [
    {
      relativePath: 'src/generated/widgets.ts',
      content: await format(emitWidgetsFile(snapshot, slots)),
    },
    {
      relativePath: 'src/generated/delegates.ts',
      content: await format(emitDelegatesFile(snapshot, surface)),
    },
    {
      relativePath: 'src/generated/constants.ts',
      content: await format(emitConstantsFile(snapshot)),
    },
    {
      relativePath: 'src/generated/index.ts',
      content: await format(emitGeneratedIndex(snapshot)),
    },
  ];
};
