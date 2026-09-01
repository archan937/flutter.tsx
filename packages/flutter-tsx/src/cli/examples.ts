import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { FLUTTER_TSX_VERSION } from '../index';
import { packageNameFrom } from './init';
import { scaffoldFiles } from './scaffold';
import {
  loadTemplate,
  type Template,
  TEMPLATE_FEATURES,
  TEMPLATE_NAMES,
} from './templates';

export const EXAMPLES_DIR = new URL('../../../../examples/', import.meta.url)
  .pathname;

const ORG = 'dev.fluttertsx';

/**
 * The files `fsx init --template=<name>` writes, for one example.
 *
 * Only the files Flutter.tsx owns: the platform directories and the generated
 * `lib/` are `flutter create`'s and the compiler's, and neither belongs in
 * version control.
 */
export const exampleFiles = (
  template: Template,
): { path: string; contents: string }[] => {
  const name = packageNameFrom(join(EXAMPLES_DIR, template.name));
  return [
    ...scaffoldFiles(
      {
        name,
        bundleId: `${ORG}.${name.replace(/_/g, '')}`,
        version: FLUTTER_TSX_VERSION,
        target: template.target,
        plugins: template.plugins,
      },
      template.sources,
    ),
    { path: 'README.md', contents: readme(template) },
  ].sort((first, second) => first.path.localeCompare(second.path));
};

/** What the example is, how to run it, and what to look at inside it. */
const readme = (template: Template): string => {
  const features = (TEMPLATE_FEATURES[template.name] ?? [])
    .map((feature) => `- ${feature}`)
    .join('\n');
  const plugins = Object.keys(template.plugins).sort();
  const usesPlugins =
    plugins.length === 0
      ? ''
      : `\nPub packages: ${plugins.map((name) => `\`${name}\``).join(', ')} — ` +
        '`fsx init` installs them for you.\n';
  return `# ${template.name} example

${template.blurb}

\`\`\`bash
fsx init my-app --template=${template.name}
cd my-app && bun install && bun run dev
\`\`\`

## What it shows

${features}
${usesPlugins}
## How it is kept honest

This directory is generated from \`packages/flutter-tsx/templates/${template.name}\`
by \`bun run examples\`, and a test asserts the two are byte-identical — so it
is exactly what the command above writes. Every template is transpiled,
\`flutter analyze\`d and built for ${template.target} on every run of the e2e
suite.
`;
};

/** The index of the four apps, for whoever opens `examples/` on GitHub. */
export const examplesIndex = (templates: readonly Template[]): string =>
  [
    '# Examples',
    '',
    'Four complete Flutter.tsx apps, one per kind of target. Each is what',
    '`fsx init --template=<name>` writes for you, and each is transpiled,',
    '`flutter analyze`d and built for its own platform on every run of the',
    'end-to-end suite.',
    '',
    '| Example | Target | What it is |',
    '| --- | --- | --- |',
    ...templates.map(
      (template) =>
        `| [\`${template.name}\`](${template.name}) | \`${template.target}\` | ${template.blurb} |`,
    ),
    '',
    '```bash',
    'fsx init my-app --template=web',
    'cd my-app && bun install && bun run dev',
    '```',
    '',
    'These directories are generated from',
    '`packages/flutter-tsx/templates/` by `bun run examples`, and a test',
    'asserts they match byte-for-byte — so nothing here can drift from what',
    'the command actually produces. Edit the template, not the example.',
    '',
  ].join('\n');

/** Writes every example, replacing what is there. */
export const writeExamples = async (
  into: string = EXAMPLES_DIR,
): Promise<string[]> => {
  const written: string[] = [];
  const templates: Template[] = [];
  for (const name of TEMPLATE_NAMES) {
    const template = await loadTemplate(name);
    templates.push(template);
    const directory = join(into, name);
    await rm(directory, { recursive: true, force: true });
    for (const file of exampleFiles(template)) {
      const path = join(directory, file.path);
      await mkdir(dirname(path), { recursive: true });
      await Bun.write(path, file.contents);
      written.push(join(name, file.path));
    }
  }
  await Bun.write(join(into, 'README.md'), examplesIndex(templates));
  written.push('README.md');
  return written;
};
