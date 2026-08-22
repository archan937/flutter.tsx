export const runCommand = (command: string[], cwd: string): Promise<number> => {
  const process = Bun.spawn(command, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  return process.exited;
};
