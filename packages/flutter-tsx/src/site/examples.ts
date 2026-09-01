import { type Template, TEMPLATE_FEATURES, TEMPLATES } from '../cli/templates';

/** One template, as the docs describe it. */
export interface ExampleSummary {
  name: string;
  target: string;
  blurb: string;
  features: readonly string[];
  plugins: readonly string[];
  files: readonly string[];
}

export const summarizeExample = (template: Template): ExampleSummary => ({
  name: template.name,
  target: template.target,
  blurb: template.blurb,
  features: TEMPLATE_FEATURES[template.name] ?? [],
  plugins: Object.keys(template.plugins).sort(),
  files: template.sources.map((file) => file.path).sort(),
});

const codeFence = (lines: string[]): string =>
  ['```bash', ...lines, '```'].join('\n');

const section = (example: ExampleSummary): string =>
  [
    `## ${example.name}`,
    '',
    example.blurb,
    '',
    codeFence([
      `fsx init my-app --template=${example.name}`,
      'cd my-app && bun install && bun run dev',
    ]),
    '',
    '### What it shows',
    '',
    ...example.features.map((feature) => `- ${feature}`),
    '',
    ...(example.plugins.length === 0
      ? []
      : [
          `Pub packages: ${example.plugins
            .map((name) => `\`${name}\``)
            .join(', ')} — \`fsx init\` adds and installs them.`,
          '',
        ]),
    '### The files it writes',
    '',
    ...example.files.map((file) => `- \`${file}\``),
    '',
    `Built for \`${example.target}\` on every run of the end-to-end suite, and ` +
      `committed under [\`examples/${example.name}\`](https://github.com/archan937/flutter.tsx/tree/master/examples/${example.name}).`,
    '',
  ].join('\n');

/**
 * The Examples page.
 *
 * Written from the template registry itself, so the page cannot describe an
 * app that is not there — the same four apps `fsx init --template` writes and
 * the e2e suite builds.
 */
export const examplesMarkdown = (templates: readonly Template[]): string => {
  const summaries = templates.map(summarizeExample);
  return [
    '# Examples',
    '',
    'Four complete apps, one per kind of target. Each is a starting point',
    '`fsx init` writes for you, and each is transpiled, analysed and built by',
    'the end-to-end suite on every run — so what you read here is what',
    'compiles.',
    '',
    codeFence([
      `fsx init my-app --template=<${Object.keys(TEMPLATES).sort().join('|')}>`,
    ]),
    '',
    ...summaries.map(section),
  ].join('\n');
};
