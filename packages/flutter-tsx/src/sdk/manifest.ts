import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface SdkManifest {
  flutterVersion: string;
  archive: string;
  sha256: string;
  installedAt: string;
}

export interface FsxPaths {
  home: string;
  sdkDir: string;
  manifestPath: string;
  tmpDir: string;
}

export const resolveFsxPaths = (
  env: Record<string, string | undefined>,
  homeDir: string,
): FsxPaths => {
  const home = env.FSX_HOME ?? join(homeDir, '.fsx');
  return {
    home,
    sdkDir: join(home, 'flutter'),
    manifestPath: join(home, 'sdk-manifest.json'),
    tmpDir: join(home, 'tmp'),
  };
};

const isSdkManifest = (value: unknown): value is SdkManifest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.flutterVersion === 'string' &&
    typeof record.archive === 'string' &&
    typeof record.sha256 === 'string' &&
    typeof record.installedAt === 'string'
  );
};

export const readManifest = async (
  path: string,
): Promise<SdkManifest | null> => {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return null;
  }
  try {
    const parsed: unknown = await file.json();
    return isSdkManifest(parsed) ? parsed : null;
  } catch {
    // An unreadable manifest means the SDK state is unknown: treat as not installed.
    return null;
  }
};

export const writeManifest = async (
  path: string,
  manifest: SdkManifest,
): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, `${JSON.stringify(manifest, null, 2)}\n`);
};
