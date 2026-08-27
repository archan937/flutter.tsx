import { loadPluginApi } from '@src/plugins/api';
import { emitPluginDeclaration } from '@src/plugins/emit-types';
import { deriveHooks } from '@src/plugins/hooks';
import { PLUGIN_OVERRIDES } from '@src/plugins/overrides';

const packageName = process.argv[2];
if (packageName === undefined) {
  console.error('usage: bun scripts/generate-plugin-types.ts <pub-package>');
  process.exit(2);
}

const api = await loadPluginApi(packageName);
const hooks = deriveHooks(api, PLUGIN_OVERRIDES[packageName]);
const declaration = emitPluginDeclaration(api, hooks);
const outPath = new URL(
  `../test/fixtures/types/${packageName}.d.ts`,
  import.meta.url,
).pathname;
await Bun.write(outPath, declaration);
console.log(
  `Wrote ${outPath.split('/').slice(-3).join('/')} (${api.package} ${api.version}, ${hooks.length} hook(s)).`,
);
