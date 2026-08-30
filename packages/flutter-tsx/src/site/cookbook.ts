import { dartFileFor } from '../compiler/dart-names';
import { CATALOGUE, CATEGORIES } from './catalogue';
import { codeBlock, HIGHLIGHT_CSS } from './highlight';
import type { SitePage } from './model';
import { escapeHtml, inlineDoc } from './render';
import {
  NAV_CSS,
  type NavGroup,
  navGroupsHtml,
  SHELL_CSS,
  SHELL_JS,
  sidebarHtml,
  type SitePageId,
} from './shell';

/** One file of an example, on both sides of the compiler. */
export interface RecipeFile {
  tsxName: string;
  tsx: string;
  dartName: string;
  dart: string;
}

/** One certified fixture, shown as the TSX written and the Dart emitted. */
export interface Recipe {
  id: string;
  title: string;
  blurb: string;
  category: string;
  /** The entry file's TSX and Dart, which most examples are all of. */
  tsx: string;
  dart: string;
  /** Every file of the example, entry first — an example spanning two files
   * that shows one of them explains nothing. */
  files: RecipeFile[];
}

const FIXTURE_ID = /^\d+-/;

// `import { UserCard } from './UserCard'` — the sibling files an example is
// actually made of, as opposed to the ones a fixture keeps for other reasons.
const RELATIVE_IMPORT = /from '\.\/([A-Za-z0-9_]+)'/g;

// A file exporting several components is named after its subject, which is
// the last one: `23-tabs` exports two tabs and then the Shell holding them.
const EXPORTED_NAMES = /^export const (\w+)/gm;

const subjectOf = (tsx: string, label: string): string => {
  const subject = [...tsx.matchAll(EXPORTED_NAMES)].at(-1)?.[1];
  if (subject === undefined) {
    throw new Error(`the showcase fixture ${label} exports no component.`);
  }
  return subject;
};

const readFile = async (path: string): Promise<string | null> => {
  const file = Bun.file(path);
  return (await file.exists()) ? file.text() : null;
};

/**
 * Every conformance fixture, read straight from the suite. Each pair is
 * proven: the golden test asserts the Dart byte-for-byte, `dart format`
 * certifies its layout, and the analyzer certifies that it compiles.
 */
const filePair = (tsxName: string, tsx: string, dart: string): RecipeFile => {
  const subject = subjectOf(tsx, tsxName);
  return {
    tsxName: `src/${subject}.tsx`,
    tsx,
    dartName: dartFileFor(`${subject}.tsx`),
    dart,
  };
};

const importedFiles = async (
  dir: string,
  entryTsx: string,
): Promise<RecipeFile[]> => {
  const files: RecipeFile[] = [];
  for (const match of entryTsx.matchAll(RELATIVE_IMPORT)) {
    const name = match[1] ?? '';
    const tsx = await readFile(`${dir}/${name}.tsx`);
    if (tsx === null) continue;
    const dart = await readFile(`${dir}/${dartFileFor(`${name}.tsx`)}`);
    if (dart === null) continue;
    files.push(filePair(`${name}.tsx`, tsx, dart));
  }
  return files;
};

export const loadRecipes = async (fixturesDir: string): Promise<Recipe[]> => {
  const recipes: Recipe[] = [];
  for await (const entry of new Bun.Glob('*/input.tsx').scan({
    cwd: fixturesDir,
  })) {
    const id = entry.slice(0, entry.indexOf('/'));
    if (!FIXTURE_ID.test(id)) continue;
    const dir = `${fixturesDir}/${id}`;
    const dart = await readFile(`${dir}/expected.dart`);
    if (dart === null) continue;
    const tsx = await Bun.file(`${fixturesDir}/${entry}`).text();

    const listed = CATALOGUE[id];
    if (listed === undefined) {
      throw new Error(
        `fixture ${id} has no catalogue entry — a reader would get two ` +
          'unexplained code blocks.',
      );
    }
    recipes.push({
      id,
      title: listed.title,
      blurb: listed.blurb,
      category: listed.category,
      tsx,
      dart,
      files: [filePair(entry, tsx, dart), ...(await importedFiles(dir, tsx))],
    });
  }
  return recipes.sort((first, second) => first.id.localeCompare(second.id));
};

const PAGE_CSS = `
${SHELL_CSS}
${NAV_CSS}
main { padding-top: 40px; }
.lede, .note { color: var(--muted); max-width: 68ch; }
.note { font-size: 14px; }
.recipe { border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px;
  margin-bottom: 22px; scroll-margin-top: 20px; background: var(--panel); }
.recipe[hidden] { display: none; }
.recipe h3 { font-family: var(--display); font-size: 18px; font-weight: 700;
  letter-spacing: -.01em; margin-bottom: 8px; color: var(--text); }
.recipe .blurb { color: var(--muted); font-size: 14px; margin-bottom: 16px; max-width: 68ch; }
.pair { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; margin-bottom: 12px; }
@media (max-width: 1100px) { .pair { grid-template-columns: 1fr; } }
.pane { border: 1px solid var(--line); border-radius: 10px; overflow: hidden;
  background: rgba(7,9,15,.5); min-width: 0; }
.pane h4 { padding: 8px 12px; font-family: var(--mono); font-size: 11px; font-weight: 600;
  color: var(--dim); border-bottom: 1px solid var(--line); letter-spacing: .02em; }
pre { margin: 0; padding: 14px; overflow-x: auto; }
code { font-family: var(--mono); font-size: 12.5px; line-height: 1.6; }
main table { border-collapse: collapse; margin: 16px 0; width: 100%; font-size: 14px; }
main th, main td { border: 1px solid var(--line); padding: 8px 12px; text-align: left; vertical-align: top; }
main th { color: var(--dim); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
main p code, main li code, main td code { font-family: var(--mono); font-size: .9em;
  background: rgba(255,255,255,.06); padding: .1em .4em; border-radius: 5px; color: var(--react); }
main ul { margin: 12px 0 12px 20px; }
main h3 { font-family: var(--display); font-size: 17px; margin: 28px 0 8px; }
main p { margin-bottom: 12px; }
${HIGHLIGHT_CSS}`;

const filePanes = (file: RecipeFile): string =>
  `<div class="pair">
<div class="pane"><h4>${escapeHtml(file.tsxName)}</h4>${codeBlock(file.tsx, 'tsx')}</div>
<div class="pane"><h4>${escapeHtml(file.dartName)}</h4>${codeBlock(file.dart, 'dart')}</div>
</div>`;

const recipeSection = (recipe: Recipe): string =>
  `<section class="recipe" id="${escapeHtml(recipe.id)}" data-name="${escapeHtml(recipe.title)}">
<h3>${escapeHtml(recipe.title)}</h3>
<p class="blurb">${inlineDoc(recipe.blurb)}</p>
${recipe.files.map(filePanes).join('\n')}
</section>`;

const byCategory = (recipes: Recipe[]): [string, Recipe[]][] =>
  CATEGORIES.map((category): [string, Recipe[]] => [
    category,
    recipes.filter((recipe) => recipe.category === category),
  ]).filter(([, members]) => members.length > 0);

const cookbookNav = (recipes: Recipe[]): NavGroup[] =>
  byCategory(recipes).map(([category, members], index) => ({
    title: category,
    open: index === 0,
    items: members.map((recipe) => ({ id: recipe.id, label: recipe.title })),
  }));

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
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="bg-layer bg-grid"></div>
<div class="bg-layer bg-glow"></div>
${sidebarHtml(
  {
    meta: `${recipes.length} recipes · Flutter ${flutterVersion}`,
    searchPlaceholder: 'Search recipes…',
    current: 'cookbook',
  },
  navGroupsHtml(cookbookNav(recipes)),
)}
<main>
<h1>Cookbook</h1>
<p class="lede">Every example here is a conformance fixture: the TSX you write on the left, the Dart <code>fsx</code> emits on the right, and nothing typed by hand in between. Each pair is asserted byte-for-byte by the golden tests, laid out by <code>dart format</code>, checked by <code>flutter analyze</code>, and built as a real Flutter app on every run.</p>
${byCategory(recipes)
  .map(
    ([category, members]) =>
      `<h2 id="${escapeHtml(category.toLowerCase().replaceAll(' ', '-'))}">${escapeHtml(category)}</h2>\n` +
      members.map(recipeSection).join('\n'),
  )
  .join('\n')}
<p id="no-results">No recipes match your search.</p>
</main>
<script>
(function () {
  'use strict';
${SHELL_JS}
})();
</script>
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

/** What a fixture would be called in a project, on both sides of the compiler. */
export const showcaseFiles = (
  recipe: Recipe,
): { tsx: string; dart: string } => {
  const subject = subjectOf(recipe.tsx, recipe.id);
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
  `${codeBlock(recipe[kind], kind === 'tsx' ? 'tsx' : 'dart')}\n` +
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
  /** Which entry of the main nav this page is. */
  current: SitePageId;
}

/** The prose pages, rendered from the markdown that is their source. */
export const DOC_PAGES: DocPage[] = [
  { source: 'guide.md', title: 'Guide', current: 'guide' },
  {
    source: 'config-mapping.md',
    title: 'Config mapping',
    current: 'config',
  },
];

const BODY_HEADING = /<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g;

/** The page's own sections, so a long guide is navigable from anywhere in it. */
const docNav = (page: DocPage, body: string): NavGroup[] => [
  {
    title: page.title,
    open: true,
    items: [...body.matchAll(BODY_HEADING)].map((match) => ({
      id: match[1] ?? '',
      label: (match[2] ?? '').replace(/<[^>]+>/g, ''),
    })),
  },
];

/** Wraps rendered markdown in the same chrome the rest of the site uses. */
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
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>${PAGE_CSS}
main pre { border: 1px solid var(--line); border-radius: 10px; background: rgba(7,9,15,.5); margin: 14px 0; }
</style>
</head>
<body>
<div class="bg-layer bg-grid"></div>
<div class="bg-layer bg-glow"></div>
${sidebarHtml(
  {
    meta: `${page.title} · Flutter.tsx`,
    searchPlaceholder: 'Search sections…',
    current: page.current,
  },
  navGroupsHtml(docNav(page, body)),
)}
<main>
${body}
</main>
<script>
(function () {
  'use strict';
${SHELL_JS}
})();
</script>
</body>
</html>
`;
