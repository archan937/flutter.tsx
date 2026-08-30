import { loadPluginApi, type PluginApi } from '../plugins/api';
import { PLUGIN_OVERRIDES } from '../plugins/overrides';
import { loadRecipes, type Recipe, SHOWCASE } from './cookbook';
import { extractCoreApi } from './core-api';
import type { SiteSections } from './from-snapshot';
import { buildSitePlugins } from './plugins';

const REFERENCE_DIR = '../../ref/plugins';
const FIXTURES_DIR = '../../test/fixtures';

/** The runtime surface the compiler understands, declared rather than generated. */
const CORE_SOURCES = ['../runtime/hooks.ts', '../runtime/shell.ts'];

/** The generated declarations that ship: where the value types are read from. */
const GENERATED_SOURCES = ['../generated/widgets.ts'];

const resolve = (relative: string): string =>
  new URL(relative, import.meta.url).pathname;

const loadPluginApis = async (): Promise<PluginApi[]> => {
  const names: string[] = [];
  for await (const entry of new Bun.Glob('*.json').scan({
    cwd: resolve(REFERENCE_DIR),
  })) {
    names.push(entry.replace(/\.json$/, ''));
  }
  return Promise.all(names.sort().map((name) => loadPluginApi(name)));
};

/** The fixture the reference opens with, refused when the suite loses it. */
export const exampleFrom = (recipes: Recipe[]): SiteSections['example'] => {
  const recipe = recipes.find((each) => each.id === SHOWCASE);
  if (recipe === undefined) {
    throw new Error(`the example fixture ${SHOWCASE} is missing.`);
  }
  return {
    id: recipe.id,
    title: recipe.title,
    tsx: recipe.tsx,
    dart: recipe.dart,
  };
};

/**
 * Everything the reference documents beside the SDK snapshot, assembled once
 * so the generator and the freshness gate read the same sources — a page that
 * drifts from them fails the build rather than shipping.
 */
export const loadSiteSections = async (): Promise<SiteSections> => {
  const recipes = await loadRecipes(resolve(FIXTURES_DIR));
  return {
    example: exampleFrom(recipes),
    coreApi: extractCoreApi(CORE_SOURCES.map(resolve), recipes),
    plugins: buildSitePlugins(
      await loadPluginApis(),
      PLUGIN_OVERRIDES,
      recipes,
    ),
    generatedFiles: GENERATED_SOURCES.map(resolve),
  };
};
