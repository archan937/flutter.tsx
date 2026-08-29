import { access } from 'node:fs/promises';

/** Whether a path exists, without throwing when it does not. */
export const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/** Runs one binary with varying arguments, streaming its output. */
export const commandRunner =
  (binary: string) =>
  (args: string[], cwd: string): Promise<number> =>
    Bun.spawn([binary, ...args], {
      cwd,
      stdout: 'inherit',
      stderr: 'inherit',
    }).exited;
