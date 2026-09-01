import { describe, expect, test } from 'bun:test';

import {
  loadTemplate,
  TEMPLATE_FEATURES,
  TEMPLATE_NAMES,
  templateDir,
  TEMPLATES,
} from '@src/cli/templates';
import { transpileComponent } from '@src/compiler/transpile';

const PLUGIN_API_DIR = new URL('../../ref/plugins', import.meta.url).pathname;

describe('the template registry', () => {
  test('names the four apps `fsx init --template` writes', () => {
    expect(TEMPLATE_NAMES).toEqual(['desktop', 'mobile', 'tray', 'web']);
  });

  test('every template says what it shows and where it builds', () => {
    for (const name of TEMPLATE_NAMES) {
      expect([name, (TEMPLATES[name]?.blurb ?? '').length > 0]).toEqual([
        name,
        true,
      ]);
      expect([name, (TEMPLATE_FEATURES[name] ?? []).length > 0]).toEqual([
        name,
        true,
      ]);
    }
  });

  test('an unknown template is refused, with the ones that exist', () => {
    expect(loadTemplate('phone')).rejects.toThrow(
      new Error(
        'unknown template `phone` — available: desktop, mobile, tray, web.',
      ),
    );
  });

  test('a template source that cannot be read is reported, not skipped', () => {
    // A source that goes missing between the listing and the read would
    // otherwise scaffold a project with a file silently absent.
    expect(loadTemplate('web', () => Promise.resolve(null))).rejects.toThrow(
      /template file is unreadable: .*templates\/web\/src\//,
    );
  });
});

describe('every template is a project the compiler accepts', () => {
  for (const name of TEMPLATE_NAMES) {
    test(`${name} declares every plugin its sources import`, async () => {
      const template = await loadTemplate(name);
      const imported = [
        ...new Set(
          template.sources.flatMap((file) =>
            [...file.contents.matchAll(/from 'plugin:([^']+)'/g)].map(
              (match) => match[1] ?? '',
            ),
          ),
        ),
      ].sort();

      // A plugin a source imports and the manifest does not declare would
      // scaffold an app that cannot resolve its own dependencies.
      expect([name, imported]).toEqual([
        name,
        imported.filter((each) => each in template.plugins),
      ]);
    });

    test(`${name} starts from a root component or a router`, async () => {
      const template = await loadTemplate(name);

      expect([
        name,
        template.sources.some(
          (file) =>
            file.path === 'src/App.tsx' ||
            file.contents.includes('createRouter('),
        ),
      ]).toEqual([name, true]);
    });

    test(`${name} transpiles every source it ships`, async () => {
      const template = await loadTemplate(name);
      const directory = templateDir(name);

      for (const file of template.sources) {
        const dart = await transpileComponent({
          source: file.contents,
          filePath: `${directory}/${file.path}`,
          pluginApiDirs: [PLUGIN_API_DIR],
        });

        expect([file.path, dart.trim().length > 0]).toEqual([file.path, true]);
      }
    }, 120000);
  }
});
