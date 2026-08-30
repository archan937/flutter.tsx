import { dartFileFor } from '../compiler/dart-names';
import type { SitePage } from './model';
import { escapeHtml } from './render';

/** One certified fixture, shown as the TSX written and the Dart emitted. */
export interface Recipe {
  id: string;
  title: string;
  tsx: string;
  dart: string;
}

const FIXTURE_ID = /^\d+-/;

/** `28-multi-file` reads as “Multi File”. */
const titleOf = (id: string): string =>
  id
    .replace(FIXTURE_ID, '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/**
 * Every conformance fixture, read straight from the suite. Each pair is
 * proven: the golden test asserts the Dart byte-for-byte, `dart format`
 * certifies its layout, and the analyzer certifies that it compiles.
 */
export const loadRecipes = async (fixturesDir: string): Promise<Recipe[]> => {
  const recipes: Recipe[] = [];
  for await (const entry of new Bun.Glob('*/input.tsx').scan({
    cwd: fixturesDir,
  })) {
    const id = entry.slice(0, entry.indexOf('/'));
    if (!FIXTURE_ID.test(id)) continue;
    const dart = Bun.file(`${fixturesDir}/${id}/expected.dart`);
    if (!(await dart.exists())) continue;
    recipes.push({
      id,
      title: titleOf(id),
      tsx: await Bun.file(`${fixturesDir}/${entry}`).text(),
      dart: await dart.text(),
    });
  }
  return recipes.sort((first, second) => first.id.localeCompare(second.id));
};

const STYLE = `
  :root {
    --react: #61dafb; --bg: #07090f; --panel: #11151f;
    --text: #e8ecf4; --dim: #94a3b8; --line: #1f2637;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 1.25rem 4rem; background: var(--bg); color: var(--text);
    font: 16px/1.6 'Hanken Grotesk', system-ui, sans-serif;
  }
  main { max-width: 62rem; margin: 0 auto; }
  h1 { font-size: 2.25rem; margin: 2.5rem 0 0.5rem; }
  h2 { font-size: 1.4rem; margin: 3rem 0 0.75rem; scroll-margin-top: 1rem; }
  a { color: var(--react); }
  .lede, .note { color: var(--dim); }
  .contents { columns: 2; margin: 1.5rem 0 0; padding: 0; list-style: none; }
  .contents li { margin: 0.15rem 0; break-inside: avoid; }
  .pair { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; }
  @media (max-width: 60rem) { .pair { grid-template-columns: 1fr; } }
  .pane { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
  .pane h3 {
    margin: 0; padding: 0.6rem 0.9rem; font-size: 0.75rem; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--dim); border-bottom: 1px solid var(--line);
  }
  pre { margin: 0; padding: 0.9rem; overflow-x: auto; }
  code { font: 13px/1.55 'JetBrains Mono', ui-monospace, monospace; }
`;

const recipeSection = (recipe: Recipe): string =>
  `<section>
<h2 id="${escapeHtml(recipe.id)}">${escapeHtml(recipe.title)}</h2>
<div class="pair">
<div class="pane"><h3>You write — TSX</h3><pre><code>${escapeHtml(recipe.tsx.trimEnd())}</code></pre></div>
<div class="pane"><h3>fsx emits — Dart</h3><pre><code>${escapeHtml(recipe.dart.trimEnd())}</code></pre></div>
</div>
</section>`;

/** The cookbook page: every fixture, as written and as emitted. */
export const buildCookbookHtml = (
  recipes: Recipe[],
  flutterVersion: string,
): string =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Flutter.tsx — cookbook</title>
<meta name="description" content="Every Flutter.tsx conformance fixture: the TSX written and the Dart emitted, byte-for-byte.">
<link rel="icon" type="image/png" href="./icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>Cookbook</h1>
<p class="lede">Every conformance fixture in the compiler suite, as the TSX you write and the Dart it emits — nothing here is illustrative. Each pair is asserted byte-for-byte by the golden tests, laid out by <code>dart format</code>, checked by <code>flutter analyze</code>, and built as a real Flutter app on every run.</p>
<p class="note">Generated from the fixtures. Flutter ${escapeHtml(flutterVersion)}. <a href="./index.html">Home</a> · <a href="./api-reference.html">API reference</a> · <a href="./guide.html">Guide</a></p>
<ul class="contents">
${recipes.map((recipe) => `<li><a href="#${escapeHtml(recipe.id)}">${escapeHtml(recipe.title)}</a></li>`).join('\n')}
</ul>
${recipes.map(recipeSection).join('\n')}
</main>
</body>
</html>
`;

/** One certified fixture the site leads with, under the capability it shows. */
export interface Showcase {
  id: string;
  label: string;
}

/**
 * What the landing page and the API reference lead with, in this order.
 *
 * Chosen to span what the compiler does rather than to repeat one trick:
 * local state, a native plugin, list rendering, asynchronous data, a shared
 * store, routing, a tab shell and an animation. The cookbook has them all.
 */
export const SHOWCASES: readonly [Showcase, ...Showcase[]] = [
  { id: '05-counter', label: 'State' },
  { id: '01-camera-screen', label: 'Camera' },
  { id: '07-list-rendering', label: 'Lists' },
  { id: '25-http-get', label: 'Async data' },
  { id: '19-store-counter', label: 'Store' },
  { id: '20-router', label: 'Router' },
  { id: '23-tabs', label: 'Tabs' },
  { id: '24-animated', label: 'Animation' },
];

// A file exporting several components is named after its subject, which is
// the last one: `23-tabs` exports two tabs and then the Shell holding them.
const EXPORTED_NAMES = /^export const (\w+)/gm;

/** What a fixture would be called in a project, on both sides of the compiler. */
export const showcaseFiles = (
  recipe: Recipe,
): { tsx: string; dart: string } => {
  const subject = [...recipe.tsx.matchAll(EXPORTED_NAMES)].at(-1)?.[1];
  if (subject === undefined) {
    throw new Error(`the showcase fixture ${recipe.id} exports no component.`);
  }
  return { tsx: `src/${subject}.tsx`, dart: dartFileFor(`${subject}.tsx`) };
};

const recipeFor = (showcase: Showcase, recipes: Recipe[]): Recipe => {
  const recipe = recipes.find((each) => each.id === showcase.id);
  if (recipe === undefined) {
    throw new Error(`the showcase fixture ${showcase.id} is missing.`);
  }
  return recipe;
};

/** Every showcase in order, refusing to render one the suite has lost. */
export const showcaseRecipes = (recipes: Recipe[]): Recipe[] =>
  SHOWCASES.map((showcase) => recipeFor(showcase, recipes));

/** Every region of the landing page generated from the fixtures. */
const PICKER = /<!-- showcase:picker -->[\s\S]*?<!-- \/showcase:picker -->/;
const PANELS = /<!-- showcase:panels -->[\s\S]*?<!-- \/showcase:panels -->/;
const WINDOW_NAME = /(<span class="fname" id="fname">)[^<]*(<\/span>)/;
const COMPILE_NAME = /(<span id="compile-name">)[^<]*(<\/span>)/;
const EXAMPLE_MAP = /const EXAMPLES = \{[\s\S]*?\};/;
const STATS = /<!-- showcase:stats -->[\s\S]*?<!-- \/showcase:stats -->/;
const WIDGET_COUNT = /every one of the [\d,]+\n?\s*widgets/;
const FLUTTER_VERSION = /Flutter \d+\.\d+\.\d+/g;

/** What the page counts, in the order it shows them. */
const statCounts = (page: SitePage): { count: number; label: string }[] => [
  { count: page.widgets.length, label: 'Flutter Widgets' },
  { count: page.plugins.length, label: 'Native Plugins' },
  { count: page.coreApi.length, label: 'Hooks &amp; Core APIs' },
  { count: page.enums.length, label: 'Enums' },
  { count: page.types.length, label: 'Types' },
];

const statBlock = (stat: { count: number; label: string }): string =>
  `        <div class="stat">
          <div class="stat-value" data-count="${stat.count}">0</div>
          <div class="stat-label">${stat.label}</div>
        </div>`;

const pickerButton = (showcase: Showcase, index: number): string =>
  `<button class="${index === 0 ? 'active' : ''}" data-example="${escapeHtml(showcase.id)}" role="tab" aria-selected="${index === 0}">${escapeHtml(showcase.label)}</button>`;

const codePanel = (
  recipe: Recipe,
  kind: 'tsx' | 'dart',
  active: boolean,
): string =>
  `<div class="tab-panel${active ? ' active' : ''}" data-example="${escapeHtml(recipe.id)}" data-panel="${kind}">\n` +
  `<pre>${escapeHtml(recipe[kind].trimEnd())}</pre>\n` +
  `</div>`;

/**
 * The landing page's showcase, generated from the fixtures it claims to show.
 *
 * One example persuades nobody that a compiler is general, so the page offers
 * every capability in `SHOWCASES` and the reader picks. The page once carried
 * hand-written Dart, a `.g.dart` name the compiler never emits and a stale
 * version; every name, panel and number here comes from a certified fixture
 * and the snapshot, so none of it can drift again.
 */
export const withShowcase = (
  html: string,
  recipes: Recipe[],
  page: SitePage,
): string => {
  const chosen = showcaseRecipes(recipes);
  // SHOWCASES is a non-empty tuple, so the page always has something to open
  // with, and no unreachable branch is needed to say so.
  const lead = showcaseFiles(recipeFor(SHOWCASES[0], recipes));

  const picker = SHOWCASES.map(pickerButton).join('\n');
  const panels = chosen
    .flatMap((recipe, index) => [
      codePanel(recipe, 'tsx', index === 0),
      codePanel(recipe, 'dart', false),
    ])
    .join('\n');
  const map = chosen
    .map((recipe) => {
      const file = showcaseFiles(recipe);
      return `            '${recipe.id}': { tsx: '${file.tsx}', dart: '${file.dart}' },`;
    })
    .join('\n');

  return html
    .replace(
      PICKER,
      `<!-- showcase:picker -->\n<div class="picker" id="picker" role="tablist">\n${picker}\n</div>\n<!-- /showcase:picker -->`,
    )
    .replace(
      PANELS,
      `<!-- showcase:panels -->\n${panels}\n<!-- /showcase:panels -->`,
    )
    .replace(WINDOW_NAME, `$1${escapeHtml(lead.tsx)}$2`)
    .replace(COMPILE_NAME, `$1${escapeHtml(lead.tsx.replace('src/', ''))}$2`)
    .replace(EXAMPLE_MAP, `const EXAMPLES = {\n${map}\n          };`)
    .replace(
      STATS,
      `<!-- showcase:stats -->\n${statCounts(page).map(statBlock).join('\n')}\n        <!-- /showcase:stats -->`,
    )
    .replace(
      WIDGET_COUNT,
      `every one of the ${page.widgets.length}\n            widgets`,
    )
    .replace(FLUTTER_VERSION, `Flutter ${page.flutterVersion}`);
};

export interface DocPage {
  /** Source file under docs/, e.g. `guide.md`. */
  source: string;
  title: string;
}

/** The prose pages, rendered from the markdown that is their source. */
export const DOC_PAGES: DocPage[] = [
  { source: 'guide.md', title: 'Guide' },
  { source: 'config-mapping.md', title: 'Config mapping' },
];

/** Wraps rendered markdown in the same chrome the cookbook uses. */
export const buildDocPageHtml = (page: DocPage, body: string): string =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Flutter.tsx — ${escapeHtml(page.title.toLowerCase())}</title>
<link rel="icon" type="image/png" href="./icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${STYLE}
  table { border-collapse: collapse; margin: 1rem 0; width: 100%; }
  th, td { border: 1px solid var(--line); padding: 0.45rem 0.7rem; text-align: left; vertical-align: top; }
  th { color: var(--dim); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
  pre { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; margin: 1rem 0; }
  p code, li code, td code { background: var(--panel); border-radius: 4px; padding: 0.1rem 0.35rem; }
  h3 { margin: 2rem 0 0.5rem; font-size: 1.05rem; }
</style>
</head>
<body>
<main>
<p class="note"><a href="./index.html">Home</a> · <a href="./cookbook.html">Cookbook</a> · <a href="./api-reference.html">API reference</a></p>
${body}
</main>
</body>
</html>
`;
