import { codeBlock, HIGHLIGHT_CSS, type Language } from './highlight';
import type {
  SiteCoreEntry,
  SiteEnum,
  SiteExample,
  SiteLimitation,
  SitePage,
  SitePlugin,
  SitePluginRequirement,
  SiteProp,
  SiteType,
  SiteWidget,
} from './model';

export const escapeHtml = (raw: string): string =>
  raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const INLINE_CODE = /`([^`]+)`/g;

/**
 * Our own one-line prose, where `backticks` mean code. The text is escaped
 * first, so the only markup that survives is the tag this adds.
 */
export const inlineDoc = (raw: string): string =>
  escapeHtml(raw).replace(INLINE_CODE, '<code>$1</code>');

export const cleanDoc = (
  raw: string,
  options: { firstParagraphOnly?: boolean } = {},
): string => {
  if (raw === '') {
    return '';
  }
  const text = raw
    .split('\n')
    .map((line) => line.replace(/^\/\/\/\s?/, '').trimEnd())
    .join('\n')
    .trim();
  if (options.firstParagraphOnly !== true) {
    return text;
  }
  const firstBlank = text.indexOf('\n\n');
  return firstBlank === -1 ? text : text.slice(0, firstBlank).trim();
};

export const propTable = (props: SiteProp[]): string => {
  if (props.length === 0) {
    return '';
  }
  const rows = props
    .map((prop) => {
      const required = prop.required ? '✓' : '';
      return `<tr><td>${escapeHtml(prop.tsxProp)}</td><td>${escapeHtml(prop.tsType)}</td><td>${escapeHtml(prop.dartType)}</td><td class="req">${required}</td></tr>`;
    })
    .join('\n');

  return `<table class="props">
<thead><tr><th>Prop</th><th>TSX type</th><th>Dart type</th><th>Required</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
};

export const widgetSection = (widget: SiteWidget): string => {
  const summary = cleanDoc(widget.doc, { firstParagraphOnly: true });
  const table = propTable(widget.props);

  const verifiedBadge = widget.exampleComplete
    ? '<a class="badge badge-pkg" href="#verification">✓ typechecked</a>'
    : '';
  return `<article class="widget" id="${widget.name}" data-name="${widget.name}">
<h3>${escapeHtml(widget.name)}<span class="badge badge-lib">${escapeHtml(widget.library)}</span>${verifiedBadge}</h3>
${summary ? `<p class="doc">${escapeHtml(summary)}</p>` : ''}
${table}
<div class="tabs">
<div class="tab-btns" role="tablist">
<button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
<button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart constructor</button>
</div>
<div class="tab-panel active" data-panel="tsx" role="tabpanel">
${codeBlock(widget.tsxExample, 'tsx')}
</div>
<div class="tab-panel" data-panel="dart" role="tabpanel">
${codeBlock(widget.dartSignature, 'dart')}
</div>
</div>
</article>`;
};

export const enumSection = (entry: SiteEnum): string => {
  const dartValues = entry.values
    .map(
      (value) =>
        `<li><code>${escapeHtml(entry.name)}.${escapeHtml(value)}</code></li>`,
    )
    .join('\n');
  return `<article class="widget enum-entry" id="${entry.name}" data-name="${entry.name}">
<h3>${escapeHtml(entry.name)}<span class="badge badge-lib">${escapeHtml(entry.library)}</span></h3>
<div class="tabs">
<div class="tab-btns" role="tablist">
<button class="tab-btn active" data-tab="tsx" role="tab" aria-selected="true">TSX</button>
<button class="tab-btn" data-tab="dart" role="tab" aria-selected="false">Dart</button>
</div>
<div class="tab-panel active" data-panel="tsx" role="tabpanel">
${codeBlock(entry.values.map((value) => `'${value}'`).join(' | '), 'typescript')}
</div>
<div class="tab-panel" data-panel="dart" role="tabpanel">
<ul class="enum-values">${dartValues}</ul>
</div>
</div>
</article>`;
};

const tabs = (
  panels: { label: string; language: Language; code: string }[],
): string => {
  const buttons = panels
    .map(
      (panel, index) =>
        `<button class="tab-btn${index === 0 ? ' active' : ''}" data-tab="${escapeHtml(panel.label)}" role="tab" aria-selected="${index === 0}">${escapeHtml(panel.label)}</button>`,
    )
    .join('\n');
  const bodies = panels
    .map(
      (panel, index) =>
        `<div class="tab-panel${index === 0 ? ' active' : ''}" data-panel="${escapeHtml(panel.label)}" role="tabpanel">\n` +
        `${codeBlock(panel.code, panel.language)}\n` +
        `</div>`,
    )
    .join('\n');
  return `<div class="tabs">\n<div class="tab-btns" role="tablist">\n${buttons}\n</div>\n${bodies}\n</div>`;
};

const fixtureLinks = (ids: string[]): string =>
  ids
    .map(
      (id) =>
        `<a href="./cookbook.html#${escapeHtml(id)}"><code>${escapeHtml(id)}</code></a>`,
    )
    .join(', ');

/** One worked example: the TSX written beside the Dart it emits. */
export const exampleSection = (example: SiteExample): string =>
  `<article class="widget" id="example-${escapeHtml(example.id)}" data-name="${escapeHtml(example.label)}">
<h3>${escapeHtml(example.title)}<span class="badge badge-lib">${escapeHtml(example.label)}</span><a class="badge badge-pkg" href="./cookbook.html#${escapeHtml(example.id)}">certified fixture</a></h3>
${example.blurb === '' ? '' : `<p class="doc">${inlineDoc(example.blurb)}</p>`}
${tabs([
  { label: 'TSX', language: 'tsx', code: example.tsx },
  { label: 'Dart', language: 'dart', code: example.dart },
])}
</article>`;

const EXAMPLES_INTRO = `<article class="widget" id="examples-about" data-name="about the examples">
<h3>Every pair here is compiled, not written</h3>
<p class="doc">The TSX on the left is what a developer writes; the Dart on the right is what <code>fsx</code> emits from it — nothing on this page was typed by hand. Each pair is asserted byte-for-byte by the golden tests, laid out by <code>dart format</code>, checked by <code>flutter analyze</code> and built as a real Flutter app on every run. The <a href="./cookbook.html">cookbook</a> has the rest.</p>
</article>`;

const CORE_KIND_LABEL: Record<SiteCoreEntry['kind'], string> = {
  hook: 'hook',
  function: 'function',
  component: 'component',
  type: 'type',
};

export const coreApiSection = (entry: SiteCoreEntry): string => {
  const proof =
    entry.examples.length === 0
      ? ''
      : `<p class="note">Used by ${fixtureLinks(entry.examples)}</p>`;
  // A signature says what it takes; the fixture says what writing it looks
  // like, which is the part a newcomer is actually deciding on.
  const usage =
    entry.usage === null
      ? ''
      : tabs([
          { label: 'Signature', language: 'typescript', code: entry.signature },
          { label: 'TSX', language: 'tsx', code: entry.usage.tsx },
          { label: 'Dart', language: 'dart', code: entry.usage.dart },
        ]);
  return `<article class="widget" id="core-${entry.name}" data-name="${entry.name}">
<h3>${escapeHtml(entry.name)}<span class="badge badge-lib">${CORE_KIND_LABEL[entry.kind]}</span></h3>
${entry.doc === '' ? '' : `<p class="doc">${escapeHtml(entry.doc)}</p>`}
${entry.usage === null ? codeBlock(entry.signature, 'typescript') : usage}
${proof}
</article>`;
};

// What the host app has to do about a declaration, spelled out where it is
// shown: the three duties are genuinely different pieces of work.
const DUTY_NOTE: Record<SitePluginRequirement['duty'], string> = {
  merged: 'merged into your app by Gradle — nothing to add',
  required:
    'you must add these to <code>ios/Runner/Info.plist</code>, each with your own purpose string',
  conditional: 'add only if your app looks these up',
};

const requirementList = (plugin: SitePlugin): string => {
  if (plugin.requirements.length === 0) {
    return '<p class="note">Declares nothing a host app has to know about.</p>';
  }
  const items = plugin.requirements
    .map(
      (requirement) =>
        `<li>${escapeHtml(requirement.platform)} ${escapeHtml(requirement.kind)}: ` +
        requirement.values
          .map((value) => `<code>${escapeHtml(value)}</code>`)
          .join(', ') +
        ` — ${DUTY_NOTE[requirement.duty]}</li>`,
    )
    .join('\n');
  return `<p class="note">Read from the plugin's own artifacts:</p>\n<ul class="enum-values">${items}</ul>`;
};

const functionTable = (plugin: SitePlugin): string => {
  if (plugin.functions.length === 0) {
    return '';
  }
  const rows = plugin.functions
    .map(
      (fn) =>
        `<tr><td><code>${escapeHtml(fn.name)}</code></td><td><code>${escapeHtml(fn.signature)}</code></td>` +
        `<td>${escapeHtml(fn.doc)}</td></tr>`,
    )
    .join('\n');
  return `<table class="props">
<thead><tr><th>Function</th><th>Signature</th><th>What it does</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
};

const hookTable = (plugin: SitePlugin): string => {
  if (plugin.hooks.length === 0) {
    return '';
  }
  const rows = plugin.hooks
    .map(
      (hook) =>
        `<tr><td><code>${escapeHtml(hook.name)}</code></td><td><code>${escapeHtml(hook.signature)}</code></td>` +
        `<td>${hook.manages.map((name) => `<code>${escapeHtml(name)}</code>`).join(', ')}</td></tr>`,
    )
    .join('\n');
  return `<table class="props">
<thead><tr><th>Hook</th><th>Signature</th><th>Manages for you</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
};

const optionTable = (plugin: SitePlugin): string => {
  const rows = plugin.hooks
    .flatMap((hook) =>
      hook.options.map(
        (option) =>
          `<tr><td><code>${escapeHtml(hook.name)}</code></td><td><code>${escapeHtml(option.name)}</code></td>` +
          `<td><code>${escapeHtml(option.type)}</code></td>` +
          `<td>${option.values.map((value) => `<code>${escapeHtml(value)}</code>`).join(', ')}</td>` +
          `<td>${option.defaultValue === null ? "the plugin's first" : `<code>${escapeHtml(option.defaultValue)}</code>`}</td></tr>`,
      ),
    )
    .join('\n');
  if (rows === '') {
    return '';
  }
  return `<table class="props">
<thead><tr><th>Hook</th><th>Option</th><th>Type</th><th>Values</th><th>Omitted means</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
};

// Some plugins are hooks, some are plain functions, some are both; the import
// line names whatever the plugin actually gives you.
const importLine = (plugin: SitePlugin): string => {
  const names = [
    ...plugin.hooks.map((hook) => hook.name),
    ...plugin.functions.map((fn) => fn.name),
  ];
  return `import { ${names.join(', ')} } from '${plugin.module}';`;
};

export const pluginSection = (plugin: SitePlugin): string => {
  const [example] = plugin.examples;
  if (example === undefined) {
    throw new Error(`plugin ${plugin.package} reached the page unproven.`);
  }
  return `<article class="widget" id="plugin-${plugin.package}" data-name="${plugin.package}">
<h3>${escapeHtml(plugin.package)}<span class="badge badge-lib">${escapeHtml(plugin.version)}</span><a class="badge badge-pkg" href="https://pub.dev/packages/${escapeHtml(plugin.package)}">pub.dev</a></h3>
${codeBlock(importLine(plugin), 'typescript')}
${hookTable(plugin)}
${optionTable(plugin)}
${functionTable(plugin)}
${requirementList(plugin)}
${tabs([
  { label: 'TSX', language: 'tsx', code: example.tsx },
  { label: 'Dart', language: 'dart', code: example.dart },
  { label: 'Typings', language: 'typescript', code: plugin.declaration },
])}
<p class="note">Proven by ${fixtureLinks(plugin.examples.map((each) => each.id))}</p>
</article>`;
};

/**
 * What the compiler refuses, read out of the compiler rather than written
 * beside it — a limitation that stops being true disappears from this page on
 * the next build, and one that is added shows up without anyone remembering.
 */
export const limitationSection = (entry: SiteLimitation): string =>
  `<article class="widget" id="limit-${escapeHtml(entry.code)}-${escapeHtml(
    entry.message.slice(0, 24).replace(/[^A-Za-z0-9]+/g, '-'),
  )}" data-name="${escapeHtml(entry.code)}">
<h3>${escapeHtml(entry.code)}<span class="badge badge-lib">refused</span></h3>
<p class="doc">${inlineDoc(entry.message)}</p>
</article>`;

export const typeSection = (entry: SiteType): string => {
  const shape =
    entry.shape === null ? '' : codeBlock(entry.shape, 'typescript');
  const used =
    entry.usedBy.length === 0
      ? ''
      : `<p class="note">Accepted by ${entry.usedBy
          .slice(0, USED_BY_LIMIT)
          .map(
            (name) => `<a href="#${escapeHtml(name)}">${escapeHtml(name)}</a>`,
          )
          .join(
            ', ',
          )}${entry.usedBy.length > USED_BY_LIMIT ? ` and ${entry.usedBy.length - USED_BY_LIMIT} more` : ''}</p>`;
  return `<article class="widget" id="type-${entry.name}" data-name="${entry.name}">
<h3>${escapeHtml(entry.name)}<span class="badge badge-lib">${escapeHtml(entry.dartType)}</span></h3>
${entry.doc === '' ? '' : `<p class="doc">${escapeHtml(entry.doc)}</p>`}
${codeBlock(entry.accepts, 'typescript')}
${shape}
${used}
</article>`;
};

// A value type reaches hundreds of widgets; listing every one would bury the
// declaration the entry exists to show.
const USED_BY_LIMIT = 12;

export const LIBRARY_ORDER = [
  'widgets',
  'material',
  'cupertino',
  'painting',
  'rendering',
  'services',
  'gestures',
  'animation',
  'foundation',
  'scheduler',
  'semantics',
  'physics',
  'ui',
  'widget_previews',
];

const byLibrary = <TEntry extends { library: string }>(
  entries: TEntry[],
): Map<string, TEntry[]> => {
  const groups = new Map<string, TEntry[]>();
  for (const library of LIBRARY_ORDER) {
    const members = entries.filter((entry) => entry.library === library);
    if (members.length > 0) {
      groups.set(library, members);
    }
  }
  return groups;
};

const navList = (names: string[]): string =>
  names
    .map(
      (name) =>
        `<li data-name="${name}"><a href="#${name}">${escapeHtml(name)}</a></li>`,
    )
    .join('\n');

export const navHtml = (page: SitePage): string => {
  const widgetGroups = [...byLibrary(page.widgets).entries()]
    .map(
      ([library, members]) => `<details>
<summary>${escapeHtml(library)}<span class="nav-count">${members.length}</span></summary>
<ul>
${navList(members.map((member) => member.name))}
</ul>
</details>`,
    )
    .join('\n');

  return `<details open>
<summary>Examples<span class="nav-count">${page.examples.length}</span></summary>
<ul>
${page.examples
  .map(
    (example) =>
      `<li data-name="${escapeHtml(example.label)}"><a href="#example-${escapeHtml(example.id)}">${escapeHtml(example.label)}</a></li>`,
  )
  .join('\n')}
</ul>
</details>
<details>
<summary>Hooks &amp; core APIs<span class="nav-count">${page.coreApi.length}</span></summary>
<ul>
${page.coreApi
  .map(
    (entry) =>
      `<li data-name="${entry.name}"><a href="#core-${entry.name}">${escapeHtml(entry.name)}</a></li>`,
  )
  .join('\n')}
</ul>
</details>
<details open>
<summary>Widgets<span class="nav-count">${page.widgets.length}</span></summary>
<ul></ul>
${widgetGroups}
</details>
<details>
<summary>Native plugins<span class="nav-count">${page.plugins.length}</span></summary>
<ul>
${page.plugins
  .map(
    (plugin) =>
      `<li data-name="${plugin.package}"><a href="#plugin-${plugin.package}">${escapeHtml(plugin.package)}</a></li>`,
  )
  .join('\n')}
</ul>
</details>
<details>
<summary>Types<span class="nav-count">${page.types.length}</span></summary>
<ul>
${page.types
  .map(
    (entry) =>
      `<li data-name="${entry.name}"><a href="#type-${entry.name}">${escapeHtml(entry.name)}</a></li>`,
  )
  .join('\n')}
</ul>
</details>
<details>
<summary>Enums<span class="nav-count">${page.enums.length}</span></summary>
<ul>
${navList(page.enums.map((entry) => entry.name))}
</ul>
</details>
<details>
<summary>Limitations<span class="nav-count">${page.limitations.length}</span></summary>
<ul>
${page.limitations
  .map(
    (entry) =>
      `<li data-name="${escapeHtml(entry.code)}"><a href="#limitations">${escapeHtml(entry.code)}</a></li>`,
  )
  .join('\n')}
</ul>
</details>`;
};

const LIMITATIONS_INTRO = `<article class="widget" id="limitations-about" data-name="about the limitations">
<h3>What the compiler will not do</h3>
<p class="doc">Every entry here is read out of the compiler on each build, from the place that raises it. A limitation is a numbered error at compile time, never silently different Dart — so nothing on this list can reach a running app. The list shrinks as the compiler grows; it is not written by hand beside the code.</p>
</article>`;

const verificationSection = `<article class="widget" id="verification" data-name="verification">
<h3>✓ typechecked — what the badge means</h3>
<p class="doc">Every example carrying the badge is generated into a probe module and compiled by the TypeScript compiler against the published <code>flutter-tsx</code> package surface on every CI run. Examples showing a <code>{…}</code> placeholder need a value kind a later compiler step makes expressible (callbacks with bodies, controllers, animations); they are excluded from the probe and carry no badge until then.</p>
</article>`;

export const pageContent = (page: SitePage): string => {
  const widgetSections = [...byLibrary(page.widgets).entries()]
    .map(
      ([library, members]) =>
        `<h2 id="lib-${library}">Widgets — ${escapeHtml(library)}</h2>\n` +
        members.map(widgetSection).join('\n'),
    )
    .join('\n');
  const enumSections = `<h2 id="enums">Enums</h2>\n${page.enums
    .map(enumSection)
    .join('\n')}`;
  const sections = [
    `<h2 id="example-heading">Examples</h2>`,
    EXAMPLES_INTRO,
    page.examples.map(exampleSection).join('\n'),
    `<h2 id="about-verification">Verification</h2>`,
    verificationSection,
    `<h2 id="core">Hooks &amp; core APIs</h2>`,
    page.coreApi.map(coreApiSection).join('\n'),
    widgetSections,
    `<h2 id="plugins">Native plugins</h2>`,
    page.plugins.map(pluginSection).join('\n'),
    `<h2 id="types">Types</h2>`,
    page.types.map(typeSection).join('\n'),
    enumSections,
    `<h2 id="limitations">Limitations</h2>`,
    LIMITATIONS_INTRO,
    page.limitations.map(limitationSection).join('\n'),
  ];
  return sections.join('\n');
};

export const pageShell = (
  content: string,
  nav: string,
  counts: {
    widgets: number;
    enums: number;
    flutterVersion?: string;
  },
): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flutter.tsx — API Reference</title>
<link rel="icon" type="image/png" href="./icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
/* ── Design tokens (shared with the landing page) ─── */
:root {
  --react:#61dafb; --flutter:#54a4ff; --violet:#a78bfa;
  --bg:#07090f; --panel:rgba(20,26,38,.62);
  --line:rgba(120,150,200,.16); --line-soft:rgba(120,150,200,.09);
  --text:#e8eef7; --muted:#9aa6bb; --dim:#6f7c93;
  --grad:linear-gradient(115deg,#61dafb 0%,#54a4ff 48%,#a78bfa 100%);
  --display:"Bricolage Grotesque",system-ui,sans-serif;
  --body:"Hanken Grotesk",system-ui,sans-serif;
  --mono:"JetBrains Mono",ui-monospace,"SF Mono",monospace;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; }
body { display: flex; font-family: var(--body); color: var(--text); line-height: 1.6;
  background: var(--bg); min-height: 100vh; -webkit-font-smoothing: antialiased; }

/* ── Atmosphere ─── */
.bg-layer { position: fixed; inset: 0; z-index: -2; pointer-events: none; }
.bg-grid { background-image:
    linear-gradient(var(--line-soft) 1px, transparent 1px),
    linear-gradient(90deg, var(--line-soft) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 78%);
  -webkit-mask-image: radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 78%); }
.bg-glow { background:
    radial-gradient(900px 520px at 50% -160px, rgba(97,218,251,.16), transparent 70%),
    radial-gradient(820px 520px at 95% 4%, rgba(167,139,250,.12), transparent 66%); }

/* ── Sidebar ─── */
#sidebar { position: sticky; top: 0; height: 100vh; overflow-y: auto;
  width: 250px; min-width: 250px; flex-shrink: 0; padding: 18px 12px 24px; font-size: 13px;
  background: linear-gradient(180deg, rgba(17,21,31,.92), rgba(11,14,20,.84));
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-right: 1px solid var(--line); }
.sb-brand { display: flex; align-items: center; gap: 10px; text-decoration: none;
  color: var(--text); font-family: var(--mono); font-weight: 700; font-size: .95rem;
  letter-spacing: -.02em; padding: 4px 6px 16px; }
.sb-brand .mark { width: 28px; height: 28px; border-radius: 7px; object-fit: cover; display: block;
  border: 1px solid rgba(97,218,251,.4); box-shadow: 0 0 9px rgba(167,139,250,.3), 0 3px 12px rgba(167,139,250,.16); }
.sb-brand b { background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
#search { width: 100%; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px;
  font-family: var(--body); font-size: 13px; margin-bottom: 10px; outline: none;
  background: rgba(7,9,15,.6); color: var(--text); }
#search::placeholder { color: var(--dim); }
#search:focus { border-color: var(--flutter); box-shadow: 0 0 0 2px rgba(84,164,255,.18); }
.meta-info { font-family: var(--mono); font-size: 10.5px; color: var(--dim); margin-bottom: 12px; padding: 0 2px; }
.sb-gh { display: flex; gap: 8px; margin-bottom: 14px; }
.sb-gh a { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border: 1px solid var(--line);
  border-radius: 8px; font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--text);
  text-decoration: none; background: rgba(7,9,15,.5); transition: border-color .15s; }
.sb-gh a:hover { border-color: rgba(245,215,97,.45); }
.sb-gh a.ghstars svg { color: var(--amber); }

/* ── Sidebar accordion ─── */
details { margin-bottom: 2px; }
details > summary {
  cursor: pointer; list-style: none; display: flex; align-items: center;
  padding: 6px 8px; border-radius: 7px; font-weight: 600; color: var(--muted);
  user-select: none; gap: 6px; }
details > summary:hover { background: rgba(255,255,255,.04); color: var(--text); }
details > summary::-webkit-details-marker { display: none; }
details > summary::before {
  content: '▶'; font-size: 8px; color: var(--dim); flex-shrink: 0;
  transition: transform .18s; display: inline-block; width: 10px; }
details[open] > summary::before { transform: rotate(90deg); }
.nav-count { font-weight: 400; color: var(--dim); font-size: 11px; margin-left: auto; font-family: var(--mono); }
details > ul { list-style: none; padding: 2px 0 4px 18px; }
details > ul li { margin: 1px 0; }
details > ul li a {
  display: block; padding: 3px 8px; border-radius: 6px; color: var(--muted);
  text-decoration: none; font-size: 12px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; transition: background .12s, color .12s; }
details > ul li a:hover { background: rgba(255,255,255,.04); color: var(--text); }
details > ul li a.active { background: rgba(97,218,251,.12); color: var(--react); font-weight: 600; }

/* ── Main content ─── */
main { flex: 1; max-width: 920px; padding: 48px 56px; min-width: 0; }
h1 {
  font-family: var(--display); font-size: 36px; font-weight: 800; letter-spacing: -.03em; margin-bottom: 8px;
  background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.subtitle { color: var(--muted); margin-bottom: 40px; font-size: 15px; }
.subtitle code { font-family: var(--mono); font-size: .9em; background: rgba(255,255,255,.06); padding: .1em .4em; border-radius: 5px; color: var(--react); }
h2 { font-family: var(--display); font-size: 22px; font-weight: 700; letter-spacing: -.02em;
  margin: 56px 0 22px; padding-bottom: 10px; border-bottom: 1px solid var(--line); color: var(--text); }
h2:first-of-type { margin-top: 0; }

/* ── Widget card ─── */
.widget { border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px;
  margin-bottom: 22px; scroll-margin-top: 20px; background: var(--panel);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  transition: border-color .18s, box-shadow .18s; }
.widget:hover { border-color: rgba(97,218,251,.3); box-shadow: 0 14px 36px rgba(84,164,255,.1); }
.widget[hidden] { display: none; }
.widget h3 { font-family: var(--display); font-size: 17px; font-weight: 700; letter-spacing: -.01em;
  margin-bottom: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--text); }
p.doc { color: var(--muted); font-size: 14px; margin-bottom: 14px; }

/* ── Example card ─── */
.example-card h3 { font-size: 18px; }

/* ── Badges ─── */
.badge { font-family: var(--mono); font-size: 10.5px; font-weight: 600; padding: 3px 9px;
  border-radius: 999px; text-transform: lowercase; }
.badge-lib { background: rgba(84,164,255,.14); color: var(--flutter); }
.badge-cat { background: rgba(255,255,255,.05); color: var(--muted); }
.badge-pkg { background: rgba(63,208,122,.14); color: #3fd07a; }

/* ── Props table ─── */
.props { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
.props th { text-align: left; padding: 8px 11px; background: rgba(255,255,255,.03);
  border-bottom: 1px solid var(--line); font-weight: 600; color: var(--muted); }
.props td { padding: 7px 11px; border-bottom: 1px solid var(--line-soft); vertical-align: top;
  color: var(--text); }
.props td:first-child { font-family: var(--mono); font-size: 12px; color: var(--flutter); }
.props td:nth-child(2), .props td:nth-child(3) { font-family: var(--mono); font-size: 12px; color: var(--muted); }
.req { color: #ff7b9c; font-weight: 700; text-align: center; }

/* ── Tabs ─── */
.tabs { margin-top: 14px; border: 1px solid var(--line); border-radius: 11px; overflow: hidden; background: rgba(7,9,15,.5); }
.tab-btns { display: flex; background: rgba(255,255,255,.02); border-bottom: 1px solid var(--line); }
.tab-btn { background: none; border: none; border-bottom: 2px solid transparent;
  margin-bottom: -1px; padding: 9px 18px; cursor: pointer; font-family: var(--mono); font-size: 12px; font-weight: 600;
  color: var(--muted); transition: color .15s; letter-spacing: .04em; }
.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--react); border-bottom-color: var(--react); }
.tab-panel { display: none; }
.tab-panel.active { display: block; }
pre { margin: 0; background: transparent; padding: 18px; overflow-x: auto; white-space: pre; word-wrap: normal; }
code { font-family: var(--mono); font-size: 12.5px; line-height: 1.65; color: var(--text); }

/* ── Nested sidebar accordion (Widgets > categories, Native Plugins > domains) ─── */
details details { margin: 1px 0; }
details details > summary { font-size: 12px; font-weight: 500; padding: 4px 8px; }
details details > ul { padding-left: 24px; }

/* ── Enum values list ─── */
.enum-values { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 0; }
.enum-values li code { background: rgba(255,255,255,.05); border: 1px solid var(--line); border-radius: 6px;
  padding: 3px 9px; font-size: 12px; }

/* ── No-results message ─── */
#no-results { display: none; padding: 32px; text-align: center; color: var(--dim); font-size: 15px; }

/* ── Prism.js token colours (matches the landing syntax palette) ─── */
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: var(--dim); font-style: italic; }
.token.keyword, .token.rule, .token.important, .token.atrule { color: #ff7b9c; }
.token.string, .token.char, .token.attr-value, .token.regex { color: #9ce0ff; }
.token.function { color: #d2a8ff; }
.token.class-name { color: #ffb877; }
.token.number, .token.boolean, .token.builtin { color: #79c0ff; }
.token.operator, .token.entity, .token.url { color: var(--text); }
.token.punctuation { color: var(--muted); }
.token.tag, .token.selector { color: #7ee7b0; }
.token.attr-name, .token.property { color: #79c0ff; }
.token.constant, .token.symbol { color: #ffb877; }
.token.deleted { color: #ff7b9c; }
.token.inserted { color: #7ee7b0; }
.token.namespace { opacity: 0.7; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }
${HIGHLIGHT_CSS}
</style>
</head>
<body>
<div class="bg-layer bg-grid"></div>
<div class="bg-layer bg-glow"></div>
<aside id="sidebar">
  <a class="sb-brand" href="./index.html"><img class="mark" src="./icon.png" alt="flutter.tsx logo" width="28" height="28"><span>flutter<b>.tsx</b></span></a>
  <input id="search" type="search" placeholder="Search widgets…" autocomplete="off" spellcheck="false">
  <div class="meta-info">${counts.widgets} widgets · ${counts.enums} enums</div>
  <div class="sb-gh">
    <a class="ghstars" href="https://github.com/archan937/flutter.tsx/stargazers" target="_blank" rel="noopener" aria-label="Star flutter.tsx on GitHub">
      <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 .25l2.06 4.17 4.6.67-3.33 3.24.79 4.59L8 11.42l-4.12 2.16.79-4.59L1.34 5.09l4.6-.67z" /></svg>
      <span id="gh-stars">Star</span>
    </a>
    <a href="https://github.com/archan937/flutter.tsx" target="_blank" rel="noopener">GitHub ↗</a>
  </div>
  <nav id="sidebar-nav">
${nav}
  </nav>
</aside>
<main>
  <h1>Flutter.tsx — API Reference</h1>
  <p class="subtitle">Auto-generated from the Flutter ${counts.flutterVersion ?? '3'} widget catalog. Run <code>bun run docs</code> to regenerate.</p>
${content}
  <p id="no-results">No widgets match your search.</p>
</main>
<script>
(function () {
  'use strict';

  // ── Tab switching (event delegation — one listener for all cards) ─────────
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tabs = btn.closest('.tabs');
    if (!tabs) return;
    const tab = btn.dataset.tab;
    tabs.querySelectorAll('.tab-btn').forEach(function (b) {
      const active = b.dataset.tab === tab;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    tabs.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.dataset.panel === tab);
    });
  });

  // ── Search / filter ───────────────────────────────────────────────────────
  const searchEl = document.getElementById('search');
  const noResults = document.getElementById('no-results');
  const navDetails = Array.from(document.querySelectorAll('#sidebar-nav details'));
  const initialOpen = new Map(navDetails.map(function (d) { return [d, d.open]; }));

  searchEl.addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll('.widget').forEach(function (el) {
      const name = (el.dataset.name || '').toLowerCase();
      const show = !q || name.includes(q);
      el.hidden = !show;
      if (show) visible++;
    });
    if (noResults) noResults.style.display = (!q || visible > 0) ? 'none' : 'block';
    document.querySelectorAll('#sidebar-nav li[data-name]').forEach(function (li) {
      const name = (li.dataset.name || '').toLowerCase();
      li.hidden = q ? !name.includes(q) : false;
    });
    navDetails.forEach(function (d) {
      if (!q) {
        d.hidden = false;
        d.open = initialOpen.get(d) || false;
      } else {
        const hasVisible = Array.from(
          d.querySelectorAll('li[data-name]'),
        ).some(function (li) { return !li.hidden; });
        d.hidden = !hasVisible;
        if (hasVisible) d.open = true;
      }
    });
  });

  // ── Scrollspy — highlight the active sidebar link ─────────────────────────
  const anchors = Array.from(
    document.querySelectorAll('main .widget[id], main section[id]'),
  );
  const sideLinks = Array.from(document.querySelectorAll('#sidebar-nav a'));

  const onScroll = function () {
    const scrollY = window.scrollY + 100;
    let activeId = null;
    for (const el of anchors) {
      if (el.offsetTop <= scrollY) activeId = el.id;
    }
    sideLinks.forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + activeId);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Live GitHub star count ────────────────────────────────────────────────
  const starsEl = document.getElementById('gh-stars');
  if (starsEl) {
    fetch('https://api.github.com/repos/archan937/flutter.tsx')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && typeof d.stargazers_count === 'number') {
          starsEl.textContent = d.stargazers_count.toLocaleString();
        }
      })
      .catch(function () {});
  }
})();
</script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-typescript.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-jsx.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-tsx.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-dart.min.js"></script>
</body>
</html>`;

export const buildApiReferenceHtml = (page: SitePage): string =>
  pageShell(pageContent(page), navHtml(page), {
    widgets: page.widgets.length,
    enums: page.enums.length,
    flutterVersion: page.flutterVersion,
  });
