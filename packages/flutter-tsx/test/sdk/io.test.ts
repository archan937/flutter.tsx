import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import {
  commandRunner,
  download,
  ensureDir,
  extract,
  fetchJson,
  isoNow,
  pathExists,
  readTextFile,
  remove,
  replaceDir,
  writeTextFile,
} from '@src/sdk/io';

const PAYLOAD = 'flutter archive payload';
const PAYLOAD_SHA256 = new Bun.CryptoHasher('sha256')
  .update(PAYLOAD)
  .digest('hex');

const server = Bun.serve({
  port: 0,
  fetch: (request) => {
    const { pathname } = new URL(request.url);
    if (pathname === '/index.json') {
      return Response.json({ ok: true });
    }
    if (pathname === '/archive') {
      return new Response(PAYLOAD);
    }
    if (pathname === '/chunked') {
      // A stream still open after the first chunk forces a response without
      // a content-length; an immediately-closed stream gets buffered by Bun.
      const stream = new ReadableStream({
        start: async (controller): Promise<void> => {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(PAYLOAD.slice(0, 5)));
          await new Promise((resolve) => setTimeout(resolve, 5));
          controller.enqueue(encoder.encode(PAYLOAD.slice(5)));
          controller.close();
        },
      });
      return new Response(stream);
    }
    return new Response('not found', { status: 404 });
  },
});

afterAll(async () => {
  await server.stop(true);
});

const tempDir = (): Promise<string> => mkdtemp(join(tmpdir(), 'fsx-io-'));

describe('fetchJson', () => {
  test('returns the parsed payload', async () => {
    expect(await fetchJson(`${server.url.origin}/index.json`)).toEqual({
      ok: true,
    });
  });

  test('throws on a non-OK response', () => {
    expect(fetchJson(`${server.url.origin}/nope`)).rejects.toThrow(
      new Error(`request failed: ${server.url.origin}/nope → HTTP 404`),
    );
  });
});

describe('download', () => {
  test('streams to disk, hashes, and reports progress', async () => {
    const dir = await tempDir();
    const destination = join(dir, 'archive.bin');
    const progress: { received: number; total: number | null }[] = [];

    const { sha256 } = await download(
      `${server.url.origin}/archive`,
      destination,
      (received, total) => {
        progress.push({ received, total });
      },
    );

    expect(sha256).toBe(PAYLOAD_SHA256);
    expect(await Bun.file(destination).text()).toBe(PAYLOAD);
    expect(new Set(progress.map((entry) => entry.total))).toEqual(
      new Set([PAYLOAD.length]),
    );
    expect(progress.at(-1)).toEqual({
      received: PAYLOAD.length,
      total: PAYLOAD.length,
    });
  });

  test('handles responses without a content-length', async () => {
    const dir = await tempDir();
    const destination = join(dir, 'chunked.bin');
    const totals: (number | null)[] = [];

    const { sha256 } = await download(
      `${server.url.origin}/chunked`,
      destination,
      (_received, total) => {
        totals.push(total);
      },
    );

    expect(sha256).toBe(PAYLOAD_SHA256);
    expect(new Set(totals)).toEqual(new Set([null]));
  });

  test('works without a progress callback and throws on HTTP errors', async () => {
    const dir = await tempDir();

    const { sha256 } = await download(
      `${server.url.origin}/archive`,
      join(dir, 'silent.bin'),
    );
    expect(sha256).toBe(PAYLOAD_SHA256);

    expect(
      download(`${server.url.origin}/nope`, join(dir, 'error.bin')),
    ).rejects.toThrow(
      new Error(`download failed: ${server.url.origin}/nope → HTTP 404`),
    );
  });
});

describe('extract', () => {
  test('extracts an archive into a created destination', async () => {
    const dir = await tempDir();
    const sourceDir = join(dir, 'source');
    await mkdir(join(sourceDir, 'flutter'), { recursive: true });
    await Bun.write(join(sourceDir, 'flutter', 'marker.txt'), 'hello');
    const archive = join(dir, 'sdk.tar');
    const tar = Bun.spawn(['tar', '-cf', archive, '-C', sourceDir, 'flutter']);
    expect(await tar.exited).toBe(0);

    const destination = join(dir, 'out', 'nested');
    await extract(archive, destination);

    expect(
      await Bun.file(join(destination, 'flutter', 'marker.txt')).text(),
    ).toBe('hello');
  });

  test('throws with the tar exit code and its stderr on failure', async () => {
    const dir = await tempDir();

    expect(extract(join(dir, 'missing.tar'), join(dir, 'out'))).rejects.toThrow(
      /^extraction failed \(tar exit \d+\): .+$/s,
    );
  });
});

describe('pathExists / ensureDir / remove / replaceDir', () => {
  test('pathExists distinguishes files, directories, and misses', async () => {
    const dir = await tempDir();
    await Bun.write(join(dir, 'file.txt'), 'x');

    expect(await pathExists(join(dir, 'file.txt'))).toBe(true);
    expect(await pathExists(dir)).toBe(true);
    expect(await pathExists(join(dir, 'missing'))).toBe(false);
  });

  test('ensureDir creates nested directories idempotently', async () => {
    const dir = await tempDir();
    const nested = join(dir, 'a', 'b', 'c');

    await ensureDir(nested);
    await ensureDir(nested);

    expect(await pathExists(nested)).toBe(true);
  });

  test('remove deletes recursively and tolerates missing paths', async () => {
    const dir = await tempDir();
    const nested = join(dir, 'a', 'b');
    await mkdir(nested, { recursive: true });

    await remove(join(dir, 'a'));
    await remove(join(dir, 'a'));

    expect(await pathExists(join(dir, 'a'))).toBe(false);
  });

  test('replaceDir swaps a directory into place, replacing any previous one', async () => {
    const dir = await tempDir();
    const source = join(dir, 'incoming');
    const destination = join(dir, 'live', 'sdk');
    await mkdir(source, { recursive: true });
    await Bun.write(join(source, 'new.txt'), 'new');
    await mkdir(destination, { recursive: true });
    await Bun.write(join(destination, 'old.txt'), 'old');

    await replaceDir(source, destination);

    expect(await pathExists(join(destination, 'new.txt'))).toBe(true);
    expect(await pathExists(join(destination, 'old.txt'))).toBe(false);
    expect(await pathExists(source)).toBe(false);
  });
});

describe('readTextFile / writeTextFile', () => {
  test('round-trips a file, creating parent directories', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-io-text-'));
    const path = join(dir, 'nested', 'note.txt');

    expect(await readTextFile(path)).toBeNull();

    await writeTextFile(path, 'written');

    expect(await readTextFile(path)).toBe('written');
  });
});

describe('commandRunner', () => {
  test('prefixes the binary and reports the exit code', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-io-run-'));

    expect(await commandRunner('/bin/sh')(['-c', 'exit 4'], dir)).toBe(4);
  });
});

describe('isoNow', () => {
  test('returns an ISO-8601 timestamp', () => {
    expect(isoNow()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
