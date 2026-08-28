import { access, mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

export const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`request failed: ${url} → HTTP ${response.status}`);
  }
  return response.json();
};

export const download = async (
  url: string,
  destination: string,
  onProgress?: (received: number, total: number | null) => void,
): Promise<{ sha256: string }> => {
  const response = await fetch(url);
  if (!response.ok || response.body === null) {
    throw new Error(`download failed: ${url} → HTTP ${response.status}`);
  }

  const lengthHeader = response.headers.get('content-length');
  const total = lengthHeader === null ? null : Number(lengthHeader);
  const hasher = new Bun.CryptoHasher('sha256');
  const sink = Bun.file(destination).writer();
  let received = 0;

  const body: ReadableStream<Uint8Array> = response.body;
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    hasher.update(value);
    await sink.write(value);
    received += value.byteLength;
    onProgress?.(received, total);
  }
  await sink.end();

  return { sha256: hasher.digest('hex') };
};

export const extract = async (
  archivePath: string,
  destinationDir: string,
): Promise<void> => {
  await mkdir(destinationDir, { recursive: true });
  const proc = Bun.spawn(['tar', '-xf', archivePath, '-C', destinationDir], {
    stdout: 'ignore',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(
      `extraction failed (tar exit ${exitCode}): ${stderr.trim()}`,
    );
  }
};

export const pathExists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

export const ensureDir = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true });
};

export const remove = (path: string): Promise<void> =>
  rm(path, { recursive: true, force: true });

export const replaceDir = async (
  source: string,
  destination: string,
): Promise<void> => {
  await rm(destination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
  await rename(source, destination);
};

export const isoNow = (): string => new Date().toISOString();

/** Runs a command, streaming its output, and resolves with the exit code. */
export const runProcess = (command: string[], cwd: string): Promise<number> =>
  Bun.spawn(command, { cwd, stdout: 'inherit', stderr: 'inherit' }).exited;

/** Reads a file, or resolves null when it does not exist. */
export const readTextFile = async (path: string): Promise<string | null> => {
  const file = Bun.file(path);
  return (await file.exists()) ? await file.text() : null;
};

/** Writes a file, creating its parent directories. */
export const writeTextFile = async (
  path: string,
  contents: string,
): Promise<void> => {
  await Bun.write(path, contents);
};

/** Builds a runner that invokes one binary with varying arguments. */
export const commandRunner =
  (binary: string) =>
  (args: string[], cwd: string): Promise<number> =>
    runProcess([binary, ...args], cwd);
