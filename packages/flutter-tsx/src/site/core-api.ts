import type { Recipe } from './cookbook';
import { extractDeclarations } from './declarations';
import type { SiteCoreEntry, SiteCoreKind } from './model';

const HOOK_PREFIX = /^use[A-Z]/;
const COMPONENT_TYPE_PREFIX = 'FlutterComponent<';

const kindOf = (name: string, signature: string): SiteCoreKind => {
  if (HOOK_PREFIX.test(name)) return 'hook';
  if (signature.startsWith(COMPONENT_TYPE_PREFIX)) return 'component';
  return 'function';
};

const usedIn = (name: string, recipes: Recipe[]): Recipe[] => {
  const reference = new RegExp(`\\b${name}\\b`);
  return recipes.filter((recipe) => reference.test(recipe.tsx));
};

// The shortest fixture reads as an example rather than as an application.
const shortest = (recipes: Recipe[]): Recipe | null =>
  recipes.reduce<Recipe | null>(
    (best, recipe) =>
      best === null || recipe.tsx.length < best.tsx.length ? recipe : best,
    null,
  );

/**
 * The runtime core the compiler understands: every hook, factory and shell
 * component `flutter-tsx` declares, read from the declarations themselves so
 * a documented signature is the one the IDE resolves.
 *
 * A value must be exercised by a conformance fixture — documenting a hook no
 * fixture compiles would be a claim about the compiler rather than a
 * demonstration of it, so it fails the build instead. Supporting types carry
 * the fixtures that name them, which for a type is not always any.
 */
export const extractCoreApi = (
  sourceFiles: string[],
  recipes: Recipe[],
): SiteCoreEntry[] =>
  extractDeclarations(sourceFiles).map((declared): SiteCoreEntry => {
    const found = usedIn(declared.name, recipes);
    if (declared.kind === 'value' && found.length === 0) {
      throw new Error(`core API ${declared.name} has no fixture using it.`);
    }
    const usage = shortest(found);
    return {
      name: declared.name,
      kind:
        declared.kind === 'type'
          ? 'type'
          : kindOf(declared.name, declared.signature),
      signature: declared.signature,
      doc: declared.doc,
      examples: found.map((recipe) => recipe.id),
      usage:
        usage === null
          ? null
          : {
              id: usage.id,
              title: usage.title,
              label: usage.title,
              tsx: usage.tsx,
              dart: usage.dart,
            },
    };
  });
