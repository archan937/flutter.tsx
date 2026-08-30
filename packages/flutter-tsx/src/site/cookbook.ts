import { dartFileFor } from '../compiler/dart-names';
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

/** The fixture the landing page and the API reference both open with. */
export const SHOWCASE = '01-camera-screen';

const EXPORTED_COMPONENT = /^export const (\w+)/m;

/** Every place the landing page names the showcase or the Flutter version. */
const TSX_PANEL = /<!-- showcase:tsx -->[\s\S]*?<!-- \/showcase:tsx -->/;
const DART_PANEL = /<!-- showcase:dart -->[\s\S]*?<!-- \/showcase:dart -->/;
const WINDOW_NAME = /(<span class="fname" id="fname">)[^<]*(<\/span>)/;
const COMPILE_BAR = /(<div class="compile-bar">\s*<span>)[^<]*(<\/span>)/;
const TAB_NAMES = /const names = \{ tsx: '[^']*', dart: '[^']*' \};/;
const FLUTTER_VERSION = /Flutter \d+\.\d+\.\d+/g;

const panel = (kind: 'tsx' | 'dart', code: string): string =>
  `<!-- showcase:${kind} -->\n<pre>${escapeHtml(code.trimEnd())}</pre>\n<!-- /showcase:${kind} -->`;

/**
 * The landing page's showcase, replaced with the fixture it claims to show —
 * both panels, both file names, and the Flutter version the pages were
 * generated against. The page carried hand-written Dart, a `.g.dart` name the
 * compiler never emits, and a stale version; deriving all of it from the
 * fixture and the snapshot makes the page provably true and unable to drift.
 */
export const withShowcase = (
  html: string,
  recipes: Recipe[],
  flutterVersion: string,
): string => {
  const recipe = recipes.find((each) => each.id === SHOWCASE);
  if (recipe === undefined) {
    throw new Error(`the showcase fixture ${SHOWCASE} is missing.`);
  }
  const component = EXPORTED_COMPONENT.exec(recipe.tsx)?.[1];
  if (component === undefined) {
    throw new Error(`the showcase fixture ${SHOWCASE} exports no component.`);
  }
  const tsxFile = `src/${component}.tsx`;
  const dartFile = dartFileFor(`${component}.tsx`);

  return html
    .replace(TSX_PANEL, panel('tsx', recipe.tsx))
    .replace(DART_PANEL, panel('dart', recipe.dart))
    .replace(WINDOW_NAME, `$1${escapeHtml(tsxFile)}$2`)
    .replace(COMPILE_BAR, `$1${escapeHtml(component)}.tsx$2`)
    .replace(
      TAB_NAMES,
      `const names = { tsx: '${tsxFile}', dart: '${dartFile}' };`,
    )
    .replace(FLUTTER_VERSION, `Flutter ${flutterVersion}`);
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
