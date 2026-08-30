import type { SitePlugin } from './model';

const MARKER_START = '<!-- generated:plugin-requirements -->';
const MARKER_END = '<!-- /generated:plugin-requirements -->';

const REGION = new RegExp(
  `${MARKER_START}[\\s\\S]*?${MARKER_END}`.replaceAll(/[/-]/g, '\\$&'),
);

const cell = (values: string[]): string =>
  values.length === 0
    ? '—'
    : values.map((value) => `\`${value}\``).join('<br>');

const row = (plugin: SitePlugin): string => {
  const of = (kind: string): string[] =>
    plugin.requirements.find((each) => each.kind === kind)?.values ?? [];
  return (
    `| \`${plugin.package}\` | ${cell(of('Info.plist usage descriptions'))} ` +
    `| ${cell(of('permissions'))} | ${cell(of('query schemes'))} |`
  );
};

/**
 * The requirements table in `config-mapping.md`, written from the plugins
 * actually extracted rather than from memory.
 *
 * The page previously carried a hand-written table that listed capabilities
 * nothing extracts — macOS entitlements — beside plugins the reference set
 * does not ship. Generating it means the page can only claim what the
 * extractor found, and the docs gate fails when the two drift apart.
 */
export const withRequirementsTable = (
  markdown: string,
  plugins: SitePlugin[],
): string => {
  const table = [
    '| Plugin | iOS `Info.plist` | Android permissions | Android `<queries>` |',
    '| --- | --- | --- | --- |',
    ...plugins.map(row),
  ].join('\n');
  return markdown.replace(
    REGION,
    `${MARKER_START}\n\n${table}\n\n${MARKER_END}`,
  );
};
