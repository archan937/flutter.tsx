import { generateAll } from '@src/generate/output';

const packageRoot = new URL('..', import.meta.url);

for (const file of await generateAll()) {
  await Bun.write(new URL(file.relativePath, packageRoot), file.content);
  process.stdout.write(
    `Wrote ${file.relativePath} (${(file.content.length / 1024).toFixed(0)} KB)\n`,
  );
}
