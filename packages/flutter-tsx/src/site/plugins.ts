import type { PluginApi } from '../plugins/api';
import { emitPluginDeclaration, hookSignature } from '../plugins/emit-types';
import { deriveHooks, type HookOverrides } from '../plugins/hooks';
import type { Recipe } from './cookbook';
import type {
  SiteExample,
  SitePlugin,
  SitePluginHook,
  SitePluginRequirement,
} from './model';

const requirementsOf = (api: PluginApi): SitePluginRequirement[] => {
  const { android, ios } = api.permissions;
  return (
    [
      {
        platform: 'Android',
        kind: 'AndroidManifest.xml permissions',
        values: android.permissions,
      },
      {
        platform: 'Android',
        kind: 'AndroidManifest.xml query schemes',
        values: android.querySchemes,
      },
      {
        platform: 'iOS',
        kind: 'Info.plist usage descriptions',
        values: ios.usageDescriptionKeys,
      },
      {
        platform: 'iOS',
        kind: 'Info.plist query schemes',
        values: ios.querySchemes,
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
        declaration: emitPluginDeclaration(api, derived),
        requirements: requirementsOf(api),
        examples,
      };
    });
