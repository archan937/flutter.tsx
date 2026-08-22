export type ReleaseOs = 'macos' | 'linux' | 'windows';

export interface FlutterRelease {
  channel: string;
  version: string;
  dartSdkArch: string;
  archive: string;
  sha256: string;
}

export interface ReleasesIndex {
  baseUrl: string;
  releases: FlutterRelease[];
}

export interface ReleaseQuery {
  version: string;
  arch: string;
}

export const OFFICIAL_RELEASES_BASE_URL =
  'https://storage.googleapis.com/flutter_infra_release/releases';

export const releasesIndexUrl = (
  os: ReleaseOs,
  baseUrl: string = OFFICIAL_RELEASES_BASE_URL,
): string => `${baseUrl}/releases_${os}.json`;

const parseRelease = (raw: unknown, position: number): FlutterRelease => {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`releases index: release #${position} is malformed`);
  }
  const record = raw as Record<string, unknown>;
  const { channel, version, archive, sha256 } = record;
  if (
    typeof channel !== 'string' ||
    typeof version !== 'string' ||
    typeof archive !== 'string' ||
    typeof sha256 !== 'string'
  ) {
    throw new Error(`releases index: release #${position} is malformed`);
  }
  const dartSdkArch = record.dart_sdk_arch;
  return {
    channel,
    version,
    archive,
    sha256,
    dartSdkArch: typeof dartSdkArch === 'string' ? dartSdkArch : 'x64',
  };
};

export const parseReleasesIndex = (payload: unknown): ReleasesIndex => {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('releases index: expected an object');
  }
  const record = payload as Record<string, unknown>;
  const baseUrl = record.base_url;
  if (typeof baseUrl !== 'string') {
    throw new Error('releases index: base_url is missing or not a string');
  }
  const { releases } = record;
  if (!Array.isArray(releases)) {
    throw new Error('releases index: releases is missing or not an array');
  }
  return { baseUrl, releases: releases.map(parseRelease) };
};

export const selectRelease = (
  index: ReleasesIndex,
  query: ReleaseQuery,
): FlutterRelease => {
  const release = index.releases.find(
    (candidate) =>
      candidate.channel === 'stable' &&
      candidate.version === query.version &&
      candidate.dartSdkArch === query.arch,
  );
  if (release === undefined) {
    throw new Error(
      `Flutter ${query.version} (${query.arch}) not found in the stable releases index`,
    );
  }
  return release;
};

export const archiveUrl = (
  index: ReleasesIndex,
  release: FlutterRelease,
): string => `${index.baseUrl}/${release.archive}`;
