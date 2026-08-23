import type { ApiSnapshot } from '@src/api/model';
import { parseApiSnapshot } from '@src/api/parse';

const defaultSnapshotUrl = new URL('../../ref/api.json', import.meta.url);

export const loadApiSnapshot = async (
  filePath?: string,
): Promise<ApiSnapshot> => {
  const location = filePath ?? defaultSnapshotUrl.pathname;
  const file = Bun.file(location);
  if (!(await file.exists())) {
    throw new Error(
      `api.json: ${location} does not exist — run \`bun run extract\` first.`,
    );
  }
  const document: unknown = await file.json();
  return parseApiSnapshot(document);
};
