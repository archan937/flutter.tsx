import type { PluginApi } from '../plugins/api';
import {
  emitPluginDeclaration,
  functionSignature,
  hookSignature,
} from '../plugins/emit-types';
import { deriveHooks, type HookOverrides } from '../plugins/hooks';
import type { Recipe } from './cookbook';
import type {
  SiteExample,
  SitePlugin,
  SitePluginFunction,
  SitePluginHook,
  SitePluginRequirement,
} from './model';
import { cleanDoc } from './render';

// A Dart name that is not a TS identifier cannot be imported by that name.
const TS_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const requirementsOf = (api: PluginApi): SitePluginRequirement[] => {
  const { android, ios } = api.permissions;
  return (
    [
      {
        platform: 'Android',
        kind: 'permissions',
        values: android.permissions,
        // Declared in the plugin's own manifest, which Gradle's manifest
        // merger folds into the host app: nothing to copy anywhere.
        duty: 'merged',
      },
      {
        platform: 'Android',
        kind: 'query schemes',
        values: android.querySchemes,
        // Read from the plugin's example app, where its author shows them
        // behind “if your app checks for X”: an app-by-app decision.
        duty: 'conditional',
      },
      {
        platform: 'iOS',
        kind: 'Info.plist usage descriptions',
        values: ios.usageDescriptionKeys,
        duty: 'required',
      },
      {
        platform: 'iOS',
        kind: 'Info.plist query schemes',
        values: ios.querySchemes,
        duty: 'conditional',
      },
    ] satisfies SitePluginRequirement[]
  ).filter((requirement) => requirement.values.length > 0);
};

const exampleOf = (recipe: Recipe): SiteExample => ({
  id: recipe.id,
  title: recipe.title,
  tsx: recipe.tsx,
  dart: recipe.dart,
});

/**
 * The plugins section of the API reference.
 *
 * Every hook is documented with the signature its own generated typings
 * declare — `hookSignature` is the single source of both — and with the
 * conformance fixtures that import it, so a documented plugin is one the
 * compiler is proven to handle rather than one the page merely claims.
 */
export const buildSitePlugins = (
  apis: PluginApi[],
  overrides: Record<string, Record<string, HookOverrides>>,
  recipes: Recipe[],
): SitePlugin[] =>
  [...apis]
    .sort((first, second) => first.package.localeCompare(second.package))
    .map((api): SitePlugin => {
      const module = `plugin:${api.package}`;
      const derived = deriveHooks(api, overrides[api.package]);
      const hooks: SitePluginHook[] = derived.map((hook) => ({
        name: hook.hookName,
        signature: hookSignature(hook),
        manages: hook.managed,
        options: hook.options.map((option) => ({
          name: option.name,
          type: option.enumName,
          values: option.values,
          defaultValue: option.defaultMember,
        })),
      }));

      // `http` and `url_launcher` expose no hook at all: their API is these
      // top-level functions, so an import line without them names nothing.
      const functions: SitePluginFunction[] = api.functions
        .filter((fn) => TS_IDENTIFIER.test(fn.name))
        .map((fn) => ({
          name: fn.name,
          signature: functionSignature(fn),
          doc: cleanDoc(fn.doc, { firstParagraphOnly: true }),
        }));

      const examples = recipes
        .filter((recipe) => recipe.tsx.includes(`'${module}'`))
        .map(exampleOf);
      if (examples.length === 0) {
        throw new Error(
          `plugin ${api.package} has no fixture importing ${module}.`,
        );
      }

      return {
        package: api.package,
        version: api.version,
        module,
        hooks,
        functions,
        declaration: emitPluginDeclaration(api, derived),
        requirements: requirementsOf(api),
        examples,
      };
    });
