export interface ReleaseTarget {
  os: 'macos' | 'linux' | 'windows';
  arch: 'x64' | 'arm64';
}

const TARGETS: Record<string, ReleaseTarget> = {
  'darwin-arm64': { os: 'macos', arch: 'arm64' },
  'darwin-x64': { os: 'macos', arch: 'x64' },
  'linux-x64': { os: 'linux', arch: 'x64' },
  'win32-x64': { os: 'windows', arch: 'x64' },
};

export const resolveReleaseTarget = (
  platform: string,
  arch: string,
): ReleaseTarget => {
  const target = TARGETS[`${platform}-${arch}`];
  if (target === undefined) {
    throw new Error(
      `Unsupported platform: ${platform}-${arch}. Flutter ships SDK archives for ` +
        'macOS (x64/arm64), Linux (x64), and Windows (x64).',
    );
  }
  return target;
};
